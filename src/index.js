import socketClient from 'socketcluster-client'
import common from 'masq-common'
import EventEmitter from 'events'

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

const debug = false
var log = (...args) => {
  const reg = (all, cur) => {
    if (typeof (cur) === 'string') {
      return all + cur
    } else {
      return all + cur.toString()
    }
  }
  if (debug) {
    console.log('[Masq sync]', args.reduce(reg, ''))
  }
}

/**
 * Client class.
 *
 * @param  {Object} options List of constructor parameters
 */
class Client extends EventEmitter {
  constructor (options) {
    super()
    // override default options
    this.options = Object.assign({}, DEFAULTS, options)
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
   * Send a message to the channel
   * @param {string} channel - The channel name
   * @param {Message} msg -  The message
   */
  sendMessage (channel, msg) {
    // checkParameter(msg)
    if (!this.channels[channel]) {
      log('The channel is not a suscribed channel !')
    }
    this.channels[channel].socket.publish(msg)
  }

  /**
   * Send the long term public key, encrypted with an ephemeral
   * symmetric key (exchanged through another channel)
   * @param {Object} params - The public key parameters
   * @param {string} params.pubKey - The public key
   * @param {string} params.symKey - The hexadecimal string of the symmetric key (128bits)
   * @param {boolean} params.ack - Indicate if this is a response to a previous event
   */
  sendRSAPublicKey (params) {
    // get RSA public key and encrypt it
    let msg = {
      from: this.ID,
      event: 'publicKey',
      data: { key: params.publicKey + this.ID },
      to: params.to,
      ack: params.ack
    }
    this.sendMessage(msg.to, msg)
  }

  /**
   * Exchanging EC public keys
   * through the other peer channel, the EC key-pair is genera
   * @param {Object} params - The EC public key exchange parameters
   * @param {string} params.to - The channel name
   * @param {string} params.ECPublicKey - The EC public key
   * @param {string} params.signature - The signature of the EC public key
   * @param {boolean} ack - Indicate if this is a response to a previous event
   */
  sendECPublicKey (params) {
    // genECPublicKeys()
    // encrypt EC public key
    let msg = {
      from: this.ID,
      event: 'ECPublicKey',
      to: params.to,
      ack: params.ack,
      data: {
        key: params.ECPublicKey + this.ID,
        signature: params.signature
      }
    }
    this.sendMessage(msg.to, msg)
  }

  /**
   * Send the group channel key,
   * after the EC public key exchange, verification and common
   * secret derivation, we send the group key.
   * @param {Object} params - The EC public key exchange parameters
   * @param {string} params.to - The channel name
   * @param {string} params.groupkey - The group key
   */
  sendChannelKey (params) {
    // TODO encrypt
    let msg = {
      to: params.to,
      event: 'channelKey',
      from: this.ID,
      data: { key: params.groupkey }
    }
    this.sendMessage(msg.to, msg)
  }

  /**
   * Subscribe this client to its own channel.
   *
   * @return  {object} The WebSocket client
   */
  subscribeSelf () {
    this.myChannel = this.socket.subscribe(this.ID)

    const readyToTransfer = (channel) => {
      let msg = {
        event: 'readyToTransfer',
        from: this.ID,
        data: ' ready'
      }
      this.sendMessage(channel, msg)
    }

    const storeRSAPublicKey = (msg) => {
      this.emit('RSAPublicKey', { key: msg.data.key, from: msg.from })
    }
    const storeECPublicKey = (msg) => {
    }

    const deriveSecretKey = () => {
      return 'derivedSymmetricKey'
    }

    const receiveData = (msg) => {
      log('------ ACTION ------')
      log(`${msg.from} decrypts data, msg is : ${msg.data}`)
      log('------ ACTION ------')
      this.emit('channelKey', { key: msg.data.key, from: msg.from })
    }
    const verifyReceivedECPublicKey = (msg) => {
      log('------ ACTION ------')
      log(`${this.ID} verify the signature.`)
      log('------ ACTION ------')
      return true
    }

    this.myChannel.watch(msg => {
      log('****** RECEIVE ******')
      log(`From ${msg.from} : ${msg}`)
      log('****** RECEIVE ******')

      if (msg.from === this.ID) return
      if (msg.from) {
        // log(`New msg in my channel:`, msg)
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
          // log('Channel up with ' + msg.from)
        }
        if (msg.event === 'ECPublicKey') {
          // If response : we already sent the key & signature
          if (msg.ack) {
            if (verifyReceivedECPublicKey(msg.data)) {
              storeECPublicKey(msg)
              readyToTransfer(msg.from)
              this.emit('initECDH', { key: deriveSecretKey(), from: msg.from })
            }
          } else {
            if (verifyReceivedECPublicKey(msg.data)) {
              let params = {
                to: msg.from,
                ECPublicKey: 'ECPublicKey',
                signature: 'signature',
                ack: true
              }
              this.sendECPublicKey(params)
              storeECPublicKey(msg)
            }
          }
        }
        if (msg.event === 'readyToTransfer') {
          this.emit('initECDH', { key: deriveSecretKey(), from: msg.from })
        }
        if (msg.event === 'channelKey') {
          receiveData(msg)
        }
        if (msg.event === 'publicKey') {
          // If response : do not need to send again.
          if (msg.ack) {
            storeRSAPublicKey(msg)
          } else {
            storeRSAPublicKey(msg)
            let params = {
              to: msg.from,
              symmetricKey: 'symKey2',
              publicKey: 'RSAPublicKey',
              ack: true
            }
            this.sendRSAPublicKey(params)
          }
        }
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
