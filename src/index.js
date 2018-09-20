import socketClient from 'socketcluster-client'
import common from 'masq-common'
import MasqCrypto from 'masq-crypto'

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
    // override default options
    this.options = Object.assign(DEFAULTS, options)
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
    return new Promise((resolve, reject) => {
      this.socket = socketClient.create(this.options)

      this.socket.on('error', (err) => {
        return reject(err)
      })

      this.socket.on('close', (err) => {
        return reject(err)
      })

      this.socket.on('connect', async () => {
        // Also subscribe this client to its own channel by default
        await this.subscribeSelf()
        return resolve()
      })
    })
  }

  /**
   * Join another peer, by exchanging public keys
   * through a secret channel, encrypted with a symmetric key
   * @param {string} secretChannel - The channel name
   * @param {string} symKey - The hexadecimal string of the symmetric key (128bits)
   * @param {string} pubKey - The public key
   * @returns {Promise}
   */

  exchangeKeys (secretChannel, symKey, pubKey) {
    return new Promise(async (resolve, reject) => {
      // TODO: check params
      const ch = this.socket.subscribe(secretChannel)
      this.channels[secretChannel] = ch

      const cipherAES = new MasqCrypto.AES({
        mode: MasqCrypto.aesModes.GCM,
        key: symKey,
        keySize: 128
      })
      const encPublicKey = await cipherAES.encrypt(pubKey)

      const publishReady = () =>
        ch.publish({ event: 'ready', from: this.ID })
      // Send our key through the channel
      const publishKey = () =>
        ch.publish({ event: 'publicKey', from: this.ID, key: encPublicKey })

      publishReady()

      ch.watch(async (msg) => {
        // ignore our messages
        if (msg.from === this.ID) return

        if (msg.event === 'ready') return publishKey()

        if (msg.event === 'publicKey') {
          // TODO: encrypt/decrypt key using masq-crypto
          if (!msg.from || !msg.key) return

          const decPublicKey = await cipherAES.decrypt(msg.key)
          this.socket.unsubscribe(secretChannel)
          delete this.channels[secretChannel]
          publishKey()
          resolve({
            from: msg.from,
            event: msg.event,
            key: decPublicKey
          })
        }
      })
    })
  }

  /**
   * Subscribe this client to its own channel.
   *
   * @return  {object} The WebSocket client
   */
  subscribeSelf () {
    this.myChannel = this.socket.subscribe(this.ID)
    this.myChannel.watch(msg => {
      if (msg.from) {
        // console.log(`New msg in my channel:`, msg)
        if (msg.event === 'ping') {
          var data = {
            event: 'pong',
            from: this.ID
          }
          if (!this.channels[msg.from]) {
            // Subscribe to that user
            this.channels[msg.from] = {
              socket: this.socket.subscribe(msg.from)
            }
          }
          this.channels[msg.from].socket.publish(data)
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
      this.channels[peer] = {
        socket: this.socket.subscribe(peer, {
          batch: batch
        })
      }
      this.channels[peer].socket.on('subscribe', () => {
        this.channels[peer].socket.publish({
          event: 'ping',
          from: this.ID
        })
        return resolve()
      })
      this.channels[peer].socket.on('subscribeFail', () => {
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
    let pending = []
    peers.forEach((peer) => {
      const sub = this.subscribePeer(peer, true)
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
      if (!peer || peer.length === 0 || this.channels[peer] === undefined) {
        return reject(new Error('Invalid peer value'))
      }
      this.channels[peer].socket.unsubscribe()
      delete this.channels[peer]
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
    peers.push(this.ID)
    peers.sort()
    return peers[0]
  }
}

module.exports.Client = Client
