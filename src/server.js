const socketCluster = require('socketcluster-client')
const common = require('masq-common')

class Server {
  constructor (myID) {
    this.ID = myID || common.generateUUID()
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
    let self = this
    if (!options || Object.prototype.toString.call(options) !== '[object Object]') {
      // default settings
      options = {
        hostname: 'selfhost',
        port: 8000,
        autoReconnectOptions: {
          randomness: 1000,
          multiplier: 1.5,
          maxDelay: 7000
        }
      }
    }

    return new Promise((resolve, reject) => {
      self.socket = socketCluster.create(options)

      // if (self.ID === 'foo') console.log(self.socket)

      self.socket.on('error', (err) => {
        return reject(err)
      })

      self.socket.on('close', (err) => {
        return reject(err)
      })

      self.socket.on('connect', async () => {
        // Also subscribe this client to its own channel by default
        await self.subscribeSelf()
        return resolve()
      })
    })
  }

  // authorized (from) {
  //   let self = this
  // }

  subscribeSelf () {
    let self = this

    self.myChannel = self.socket.subscribe(self.ID)
    self.myChannel.watch((msg) => {
      if (msg.from) {
        // console.log(`New msg in my channel:`, msg)
        if (msg.event === 'ping') {
          var data = {
            event: 'pong',
            from: self.ID
          }
          if (!self.channels[msg.from]) {
            // Subscribe to that user
            self.channels[msg.from] = {
              socket: self.socket.subscribe(msg.from)
            }
          }
          self.channels[msg.from].socket.publish(data)
          // console.log('Channel up with ' + msg.from)
        }
        // Set up shared room
        // if (msg.event === 'pong') {
          // console.log('Channel up with ' + msg.from)
          // if (!self.room && msg.key) {
            // self.room = msg.key
            // joinRoom()
          // }
        // }
      }
    })
  }

  subscribePeer (peer, batch = false) {
    return new Promise((resolve, reject) => {
      if (!peer || peer.length === 0) {
        return reject(new Error('Invalid peer value'))
      }
      let self = this
      self.channels[peer] = {
        socket: self.socket.subscribe(peer, {
          batch: batch
        })
      }
      self.channels[peer].socket.on('subscribe', () => {
        self.channels[peer].socket.publish({
          event: 'ping',
          from: self.ID
        })
        return resolve()
      })
      self.channels[peer].socket.on('subscribeFail', () => {
        return reject(new Error('Subscribe failed'))
      })
    })
  }

  unsubscribePeer (peer) {
    return new Promise((resolve, reject) => {
      let self = this
      if (!peer || peer.length === 0 || self.channels[peer] === undefined) {
        return reject(new Error('Invalid peer value'))
      }
      self.channels[peer].socket.unsubscribe()
      delete self.channels[peer]
      return resolve()
    })
  }

  subscribePeers (peers = []) {
    if (!Array.isArray(peers)) {
      return Promise.reject(new Error('Invalid peer list'))
    }
    let self = this
    let pending = []
    peers.forEach((peer) => {
      const sub = self.subscribePeer(peer, true)
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
    let self = this
    peers.push(self.ID)
    peers.sort()
    return peers[0]
  }
}

module.exports.Server = Server
