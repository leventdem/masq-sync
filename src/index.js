import socketClient from 'socketcluster-client'
import common from 'masq-common'

// default settings
const DEFAULTS = {
  hostname: 'localhost',
  port: 9009,
  multiplex: false,
  autoReconnectOptions: {
    randomness: 1000,
    multiplier: 1.5,
    maxDelay: 7000
  }
}

/**
   * Client class.
   *
   * @param  {Object} options List of constructor parameters
   */
class Client {
  constructor (options) {
    this.options = DEFAULTS
    if (options && options.hostname) {
      this.options.hostname = options.hostname
    }
    if (options && options.port) {
      this.options.port = options.port
    }
    if (options && options.autoReconnectOptions) {
      this.options.autoReconnectOptions = options.autoReconnectOptions
    }
    if (options && options.id) {
      this.options.id = options.id
    }
    if (options && options.multiplex) {
      this.options.multiplex = options.multiplex
    }
    this.ID = this.options.id || common.generateUUID()
    this.channels = {}
    this.socket = undefined
    this.myChannel = undefined
  }

  /**
   * Init a new socketClient connection.
   *
   * @return  {Promise} Promise resolves/rejects upon connection or errors
   */
  init () {
    let self = this

    return new Promise((resolve, reject) => {
      self.socket = new socketClient.create(self.options)

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

  /**
   * Subscribe this client to its own channel.
   *
   * @return  {object} The WebSocket client
   */
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

  /**
   * Subscribe peer to a given channel.
   * 
   * @param   {string} peer A peer (device)
   * @param   {boolean} batch Whether to batch requests for increased perfomance
   * @return  {Promise} Promise resolves/rejects upon subscription or errors
   */
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

  /**
   * Subscribe a list of peers to a given channel.
   *
   * @param   {array} peers List of peers (devices)
   * @return  {Promise} Promise resolves/rejects upon subscription or errors
   */
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
   * Unsubscribe peer from a given channel.
   * 
   * @param   {string} peer A peer (device)
   * @return  {Promise} Promise resolves/rejects upon unsubscription or errors
   */
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

  /**
   * Deterministically elect a master device, by using the first element of a 
   * alphabetically ordered list of peers.
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

module.exports.Client = Client
