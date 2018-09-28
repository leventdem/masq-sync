import socketClient from 'socketcluster-client'
import common from 'masq-common'
// import MasqCrypto from 'masq-crypto'
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
      this.setWatchers()

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
    if (!this.channels[channel]) {
      log('The channel is not a suscribed channel !')
    }
    this.channels[channel].socket.publish(msg)
  }

  /**
   * Exchanging public keys
   * through the other peer channel, encrypted with a symmetric key
   * @param {string} secretChannel - The channel name
   * @param {string} symKey - The hexadecimal string of the symmetric key (128bits)
   * @param {string} pubKey - The public key
   * @returns {Promise}
   */

  exchangeKeys (channel, symKey, pubKey) {
    let msg = {
      from: this.ID,
      event: 'publicKey',
      data: { key: pubKey + this.ID },
      to: channel
    }
    this.sendMessage(msg.to, msg)
  }

  setSymmetricKey (channel) {
    let msg = {
      from: this.ID,
      event: 'initEcdh',
      to: channel
    }
    this.sendMessage(msg.to, msg)
  }

  sendData (channel, event, data) {
    let msg = {
      event: 'data',
      from: this.ID,
      data: data
    }
    this.sendMessage(channel, msg)
    log('####### SEND ########')
    log(`${msg.from} encrypts and sends data.`)
    log('####### SEND ########')
  }

  /**
   * Set the global watchers
   * Here we init ECDH to send data
   */
  setWatchers () {
    if (!this.myChannel) {
      this.myChannel = this.socket.subscribe(this.ID)
    }
    // TODO: check params
    // const initEcdh = (channel) => {
    //   let msg = {
    //     event: 'initEcdh',
    //     from: this.ID,
    //     publicKey: 'mysecretKey' + this.ID.slice(0, 5),
    //     signature: 'signature'
    //   }
    //   this.sendMessage(channel, msg)
    //   log('####### SEND ########')
    //   log(`${msg.from} sends publickKey and signature.`)
    //   log('####### SEND ########')
    // }
    // Send our key through the channel
  }

  /**
   * Subscribe this client to its own channel.
   *
   * @return  {object} The WebSocket client
   */
  subscribeSelf () {
    this.myChannel = this.socket.subscribe(this.ID)
    const initEcdhAck = (channel) => {
      let msg = {
        event: 'initEcdhAck',
        from: this.ID,
        publicKey: 'mysecretKey' + this.ID.slice(0, 5),
        signature: 'signature'
      }
      this.sendMessage(channel, msg)
      log('####### SEND ########')
      log(`${msg.from} sends publickKey and signature.`)
      log('####### SEND ########')
    }

    const readyToTransfer = (channel) => {
      let msg = {
        event: 'readyToTransfer',
        from: this.ID,
        data: ' ready'
      }
      this.sendMessage(channel, msg)
      log('####### SEND ########')
      log(`${msg.from} sends the final ready signal.`)
      log('####### SEND ########')
    }

    const sendPublicKey = (channel) => {
      let msg = {
        event: 'publicKeyAck',
        from: this.ID,
        data: { key: 'RSAPublicKey' + this.ID }
      }
      this.sendMessage(channel, msg)
      log('####### SEND ########')
      log(`${msg.from} sends her public RSA key.`)
      log('####### SEND ########')
    }
    const storePublicKey = (msg) => {
      log('####### RECEIVE ########')
      log(`From ${msg.from} : ${msg.data.key}`)
      log('####### RECEIVE ########')
      this.emit('RSAPublicKey', { key: msg.data.key, from: msg.from })
    }

    const deriveSecretKey = () => {
      // log('------ ACTION ------')
      // log(`${from} derives the secret symmetric key`)
      // log('------ ACTION ------')
      return 'derivedSymmetricKey'
    }

    const receiveData = (msg) => {
      log('------ ACTION ------')
      log(`${msg.from} decrypts data, msg is : ${msg.data}`)
      log('------ ACTION ------')
    }

    this.myChannel.watch(msg => {
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
        if (msg.event === 'initEcdh') {
          log('****** RECEIVE ******')
          log(`From ${msg.from} : ${Object.keys(msg)}`)
          log('****** RECEIVE ******')
          initEcdhAck(msg.from)
        }

        if (msg.event === 'initEcdhAck') {
          log('****** RECEIVE ******')
          log(`From ${msg.from} : ${Object.keys(msg)}`)
          log('****** RECEIVE ******')
          readyToTransfer(msg.from)
          log('derived Key operation 1: OK', deriveSecretKey())
          this.emit('initECDH', deriveSecretKey())
        }
        if (msg.event === 'readyToTransfer') {
          log('****** RECEIVE ******')
          log(`From ${msg.from} : readyToTransfer`)
          log('****** RECEIVE ******')
          log('derived Key operation 2 : OK', deriveSecretKey())
          this.emit('initECDH', deriveSecretKey())
        }
        if (msg.event === 'channelKey') {
          receiveData(msg)
        }
        if (msg.event === 'publicKey') {
          storePublicKey(msg)
          sendPublicKey(msg.from)
        }
        if (msg.event === 'publicKeyAck') {
          storePublicKey(msg)
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
