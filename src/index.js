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
   * @param   {object} opts Optional parameters
   * @return  {object} The WebSocket client
   */
  init (opts) {
    let local = this
    if (!opts || !utils.isObject(opts)) {
      // default settings
      opts = {
        hostname: 'localhost',
        port: 8000,
        autoReconnectOptions: {
          randomness: 1000,
          multiplier: 1.5,
          maxDelay: 7000
        }
      }
    }
    local.socket = socketCluster.create(opts)

    return new Promise((resolve, reject) => {
      local.socket.on('error', function (err) {
        return reject(err)
      })

      local.socket.on('connect', function () {
        // Subscribe this client to its own room by default
        local.subscribeSelf()
        return resolve()
      })

      local.socket.on('closed', function () {
        return reject(new Error('CLOSED'))
      })
    })
  }

  subscribeSelf () {
    let local = this

    local.myChannel = local.socket.subscribe(local.ID)
    local.myChannel.watch(function (msg) {
      // console.log(`New msg in my channel:`, msg)
      if (msg.event === 'ping') {
        var data = {
          event: 'pong',
          from: local.ID
        }
        if (local.room) {
          data.key = local.room
        }
        if (local.channels[msg.from]) {
          local.channels[msg.from].socket.publish(data)
          local.channels[msg.from].intro = true
          // console.log('Channel up with ' + msg.from)
        }
      }
      if (msg.event === 'pong') {
        // console.log('Channel up with ' + msg.from)
        local.channels[msg.from].intro = true
        if (!local.room && msg.key) {
          local.room = msg.key
          // joinRoom()
          // console.log('Room:', local.room)
        }
      }
    })
  }

  subscribeToPeers (peers = []) {
    let local = this
    return new Promise((resolve) => {
      peers.forEach(function (peer) {
        local.channels[peer] = {
          intro: false,
          socket: local.socket.subscribe(peer)
        }
        local.channels[peer].socket.on('subscribe', function () {
          local.channels[peer].socket.publish({
            event: 'ping',
            from: local.ID
          })
        })
      })
      return resolve()
    })
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
