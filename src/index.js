import * as utils from './utils'
const socketCluster = require('socketcluster-client')

class MasqSync {
  constructor (myID) {
    this.ID = myID || utils.newUID()
    this.channels = {}
    this.myChannel = undefined
  }
  /**
   * Create a new socketCluster WebSocket connection.
   *
   * @param   {object} options Optional parameters
   * @return  {object} The WebSocket client
   */
  init (options) {
    let local = this
    if (!options || !utils.isObject(options)) {
      // default settings
      options = {
        hostname: 'localhost',
        port: 8000,
        autoReconnectOptions: {
          randomness: 1000,
          multiplier: 1.5,
          maxDelay: 7000
        }
      }
    }

    return new Promise((resolve, reject) => {
      local.socket = socketCluster.create(options)

      // if (local.ID === 'foo') console.log(local.socket)

      local.socket.on('error', (err) => {
        return reject(err)
      })

      local.socket.on('connect', async () => {
        // Also subscribe this client to its own channel by default
        await local.subscribeSelf()
        return resolve()
      })
    })
  }

  subscribeSelf () {
    let local = this

    local.myChannel = local.socket.subscribe(local.ID)
    local.myChannel.watch((msg) => {
      if (!msg.from) {
        return
      }
      // console.log(`New msg in my channel:`, msg)
      if (msg.event === 'ping') {
        var data = {
          event: 'pong',
          from: local.ID
        }
        if (!local.channels[msg.from]) {
          // Subscribe to that user
          local.channels[msg.from] = {
            socket: local.socket.subscribe(msg.from)
          }
        }
        local.channels[msg.from].socket.publish(data)
        // console.log('Channel up with ' + msg.from)
      }
      // Set up shared room
      // if (msg.event === 'pong') {
        // console.log('Channel up with ' + msg.from)
        // if (!local.room && msg.key) {
          // local.room = msg.key
          // joinRoom()
        // }
      // }
    })
  }

  subscribePeer (peer, batch = false) {
    return new Promise((resolve, reject) => {
      if (!peer || peer.length === 0) {
        return reject(new Error('Invalid peer value'))
      }
      let local = this
      local.channels[peer] = {
        socket: local.socket.subscribe(peer, {
          batch: batch
        })
      }
      local.channels[peer].socket.on('subscribe', () => {
        local.channels[peer].socket.publish({
          event: 'ping',
          from: local.ID
        })
        return resolve()
      })
    })
  }

  subscribePeers (peers = []) {
    if (!Array.isArray(peers)) {
      return Promise.reject(new Error('Invalid peer list'))
    }
    let local = this
    let pending = []
    peers.forEach((peer) => {
      const sub = local.subscribePeer(peer, true)
      sub.catch(() => {
        // do something with err
      })
      pending.push(sub)
    })
    return Promise.all(pending)
  }

  /**
   * Deterministically elect a master device. The first element of a alphabetically
   * ordered list of peers.
   *
   * @param   {array} peers List of peers (devices)
   * @return  {string} The peer ID of the master
   */
  electMaster (peers = []) {
    let local = this
    peers.push(local.ID)
    peers.sort()
    return peers[0]
  }
}

module.exports = MasqSync
