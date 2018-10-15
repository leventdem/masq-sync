import socketClient from 'socketcluster-client'
import common from 'masq-common'
import EventEmitter from 'events'
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
 * @param  {Object} options.ID The id of the socket (hash of the RSA public key)
 * @param  {Object} options.masqStore The instance of masq
 */
class Client extends EventEmitter {
  constructor (options) {
    super()
    // override default options
    this.options = Object.assign({}, DEFAULTS, options)
    this.ID = this.options.id || common.generateUUID()
    this.channels = {}
    this.RSAExchangeEncKey = null
    this.commonECDHDerivedKey = null
    this.EC = null
    this.RSA = null
    this.masqStore = this.options.masqStore
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
   * This function stores the RSAExchangeEncKey in the current masq-sync
   * instance to en/decrypt the exchanged of the RSA public keys during
   * pairing operation/communications.
   *
   * @param {string} RSAExchangeEncKey - The hexadecimal string of the symmetric key (128bits)
   */
  saveRSAExchangeEncKey (RSAExchangeEncKey) {
    this.RSAExchangeEncKey = MasqCrypto.utils.hexStringToBuffer(RSAExchangeEncKey)
  }

  /**
   * Send the long term public key, encrypted with an ephemeral
   * symmetric key (exchanged through another channel)
   * @param {Object} params - The public key parameters
   * @param {string} params.publicKey - The public key
   * @param {string} params.symmetricKey - The hexadecimal string of the symmetric key (128bits)
   * @param {boolean} params.ack - Indicate if this is a response to a previous event
   */
  async sendRSAPublicKey (params) {
    /**
     * The symmetric key is given as parameter on the device which
     * asks the pairing.
     * The paired device generates the symmetric key must call
     * saveRSAExchangeEncKey method before sending the QRCOde or pairing link
     */

    if (params.symmetricKey) {
      this.RSAExchangeEncKey = MasqCrypto.utils.hexStringToBuffer(params.symmetricKey)
    }
    if (!params.symmetricKey && !this.RSAExchangeEncKey) {
      throw new Error('The ephemeral AES encryption key used to encrypt RSA public keys during pairing operation is not known.')
    }
    const cipherAES = new MasqCrypto.AES({
      mode: MasqCrypto.aesModes.GCM,
      key: params.symmetricKey ? MasqCrypto.utils.hexStringToBuffer(params.symmetricKey) : this.RSAExchangeEncKey,
      keySize: 128
    })

    const encPublicKey = await cipherAES.encrypt(params.publicKey)
    console.log(encPublicKey)
    console.log(`From : ${this.ID}, encrypt ${params.publicKey} -> ${encPublicKey}`)
    // Todo remove + this.ID to the key

    let msg = {
      from: this.ID,
      event: 'publicKey',
      data: { key: encPublicKey },
      to: params.to,
      ack: params.ack
    }
    this.sendMessage(msg.to, msg)
  }

  /**
   * Send the EC public key along with associated signature
   * @param {Object} params - The EC public key exchange parameters
   * @param {string} params.to - The channel name
   * @param {string} params.ECPublicKey - The EC public key
   * @param {string} params.signature - The signature of the EC public key
   * @param {boolean} ack - Indicate if this is a response to a previous event
   */
  async sendECPublicKey (params) {
    if (!this.EC) {
      this.EC = new MasqCrypto.EC({})
      await this.EC.genECKeyPair()
    }
    const ECPublicKey = await this.EC.exportKeyRaw()
    const currentDevice = await this.masqStore.getCurrentDevice()

    if (!this.RSA) {
      this.RSA = new MasqCrypto.RSA({})
      this.RSA.publicKey = currentDevice.publicKey
      this.RSA.privateKey = currentDevice.privateKey
    }
    const signature = await this.RSA.signRSA(ECPublicKey)
    let msg = {
      from: this.ID,
      event: 'ECPublicKey',
      to: params.to,
      ack: params.ack,
      data: {
        key: MasqCrypto.utils.bufferToHexString(ECPublicKey),
        signature: MasqCrypto.utils.bufferToHexString(signature)
      }
    }

    this.sendMessage(msg.to, msg)
  }

  /**
   * Send the group channel key, encrypted with common derived secret key (ECDH)
   * @param {Object} params - The group key exchange parameters
   * @param {string} params.to - The channel name
   * @param {string} params.groupkey - The group key (hex string of a 128 bit AES key)
   */
  async sendChannelKey (params) {
    if (!this.commonECDHDerivedKey) {
      console.log('Error: the ECDH common key derivation does not exist')
      return
    }

    const cipherAES = new MasqCrypto.AES({
      mode: MasqCrypto.aesModes.GCM,
      key: this.commonECDHDerivedKey,
      keySize: 128
    })
    const encGroupKey = await cipherAES.encrypt(params.groupkey)

    let msg = {
      to: params.to,
      event: 'channelKey',
      from: this.ID,
      data: { key: encGroupKey }
    }
    console.log('sendCHannel key')

    this.sendMessage(msg.to, msg)
  }

  readyToTransfer (channel) {
    let msg = {
      event: 'readyToTransfer',
      from: this.ID
    }
    this.sendMessage(channel, msg)
  }

  async decryptRSAPublicKey (msg) {
    const cipherAES = new MasqCrypto.AES({
      mode: MasqCrypto.aesModes.GCM,
      key: this.RSAExchangeEncKey,
      keySize: 128
    })
    const decPublicKey = await cipherAES.decrypt(msg.data.key)
    console.log(` ${msg.to}, decrypt ${msg.data.key} -> ${decPublicKey}`)
    return decPublicKey
  }
  async decryptGroupKey (msg) {
    if (!this.commonECDHDerivedKey) {
      console.log('Error: the ECDH common key derivation does not exist')
      return
    }
    const cipherAES = new MasqCrypto.AES({
      mode: MasqCrypto.aesModes.GCM,
      key: this.commonECDHDerivedKey,
      keySize: 128
    })
    const decGroupKey = await cipherAES.decrypt(msg.data.key)
    console.log(` group key ${msg.to}, decrypt ${msg.data.key} -> ${decGroupKey}`)
    return decGroupKey
  }

  async storeRSAPublicKey (msg, key) {
    let device = {
      name: 'name',
      RSAPublicKey: key,
      isSynched: true
    }
    console.log(` ${msg.to}, stores :`)
    console.log(device)

    await this.masqStore.addPairedDevice(device)
  }
  storeECPublicKey (msg) {

  }

  async deriveSecretKey (senderECPublicKey) {
    if (!this.EC) {
      console.log('Error : the EC key pair does not exist ')
    }
    const ECPublicKey = MasqCrypto.utils.hexStringToBuffer(senderECPublicKey)
    const ECCryptoKey = await this.EC.importKeyRaw(ECPublicKey)
    this.commonECDHDerivedKey = await this.EC.deriveKeyECDH(ECCryptoKey, 'aes-gcm', 128)
  }

  async verifyReceivedECPublicKey (msg, senderRSAPublicKey) {
    const ECPublicKey = MasqCrypto.utils.hexStringToBuffer(msg.data.key)
    const signature = MasqCrypto.utils.hexStringToBuffer(msg.data.signature)
    return MasqCrypto.RSA.verifRSA(senderRSAPublicKey, signature, ECPublicKey)
  }

  async handleGroupKey (msg) {
    const groupKey = await this.decryptGroupKey(msg)
    this.emit('channelKey', { key: groupKey, from: msg.from })
  }

  async handleRSAPublicKey (msg) {
    const RSAPublicKey = await this.decryptRSAPublicKey(msg)
    this.storeRSAPublicKey(msg, RSAPublicKey)
    this.emit('RSAPublicKey', { key: RSAPublicKey, from: msg.from })
    if (msg.ack) { return }
    // If initial request, send the RSA public key
    let params = {
      to: msg.from,
      publicKey: JSON.stringify(this.masqStore.getCurrentDevice().publicKeyRaw),
      ack: true
    }
    this.sendRSAPublicKey(params)
  }

  async handleECPublicKey (msg) {
    const devices = await this.masqStore.listDevices()
    if (!devices[msg.from].RSAPublicKey) {
      // TODO throw an error instead
      console.log(`The RSA Public key of ${msg.from} does not exist`)
      return
    }
    const senderRSAPublicKey = await MasqCrypto.RSA.importRSAPubKey(JSON.parse(devices[msg.from].RSAPublicKey))
    if (!this.verifyReceivedECPublicKey(msg, senderRSAPublicKey)) {
      // TODO send an error
      console.log('error during EC public key verification')
      return
    }
    // this.storeECPublicKey(msg)

    if (msg.ack) {
      await this.deriveSecretKey(msg.data.key)
      this.emit('initECDH', { key: this.commonECDHDerivedKey, from: msg.from })
      this.readyToTransfer(msg.from)
    } else {
      // If initial request, send EC public key
      this.EC = new MasqCrypto.EC({})
      await this.EC.genECKeyPair()
      await this.deriveSecretKey(msg.data.key)
      let params = {
        to: msg.from,
        ack: true
      }
      this.sendECPublicKey(params)
    }
  }

  /**
   * Subscribe this client to its own channel.
   *
   * @return  {object} The WebSocket client
   */
  subscribeSelf () {
    this.myChannel = this.socket.subscribe(this.ID)

    this.myChannel.watch(msg => {
      log('****** RECEIVE ******')
      log(`From ${msg.from} : ${msg}`)
      log('****** RECEIVE ******')

      if (msg.from === this.ID) return
      if (msg.from) {
        log(`New msg in my channel:`, msg.event)
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
          this.handleECPublicKey(msg)
        }
        if (msg.event === 'readyToTransfer') {
          this.emit('initECDH', { key: this.commonECDHDerivedKey, from: msg.from })
        }
        if (msg.event === 'channelKey') {
          this.handleGroupKey(msg)
        }
        if (msg.event === 'publicKey') {
          this.handleRSAPublicKey(msg)
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
