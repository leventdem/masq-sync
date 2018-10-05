'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _socketclusterClient = require('socketcluster-client');

var _socketclusterClient2 = _interopRequireDefault(_socketclusterClient);

var _masqCommon = require('masq-common');

var _masqCommon2 = _interopRequireDefault(_masqCommon);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _masqCrypto = require('masq-crypto');

var _masqCrypto2 = _interopRequireDefault(_masqCrypto);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// default settings
var DEFAULTS = {
  hostname: 'localhost',
  port: 9009,
  multiplex: false,
  autoReconnectOptions: {
    randomness: 1000,
    multiplier: 1.5,
    maxDelay: 7000
  }
};

var debug = false;
var log = function log() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  var reg = function reg(all, cur) {
    if (typeof cur === 'string') {
      return all + cur;
    } else {
      return all + cur.toString();
    }
  };
  if (debug) {
    console.log('[Masq sync]', args.reduce(reg, ''));
  }
};

/**
 * Client class.
 *
 * @param  {Object} options List of constructor parameters
 * @param  {Object} options.ID The id of the socket (hash of the RSA public key)
 * @param  {Object} options.masqStore The instance of masq
 */

var Client = function (_EventEmitter) {
  (0, _inherits3.default)(Client, _EventEmitter);

  function Client(options) {
    (0, _classCallCheck3.default)(this, Client);

    // override default options
    var _this = (0, _possibleConstructorReturn3.default)(this, (Client.__proto__ || Object.getPrototypeOf(Client)).call(this));

    _this.options = Object.assign({}, DEFAULTS, options);
    _this.ID = _this.options.id || _masqCommon2.default.generateUUID();
    _this.channels = {};
    _this.masqStore = _this.options.masqStore;
    _this.socket = undefined;
    _this.myChannel = undefined;
    return _this;
  }

  /**
   * Init a new socketClient connection.
   *
   * @return  {Promise} Promise resolves/rejects upon connection or errors
   */


  (0, _createClass3.default)(Client, [{
    key: 'init',
    value: function init() {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        _this2.socket = _socketclusterClient2.default.create(_this2.options);

        _this2.socket.on('error', function (err) {
          return reject(err);
        });

        _this2.socket.on('close', function (err) {
          return reject(err);
        });

        _this2.socket.on('connect', (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
          return _regenerator2.default.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _context.next = 2;
                  return _this2.subscribeSelf();

                case 2:
                  return _context.abrupt('return', resolve());

                case 3:
                case 'end':
                  return _context.stop();
              }
            }
          }, _callee, _this2);
        })));
      });
    }

    /**
     * Send a message to the channel
     * @param {string} channel - The channel name
     * @param {Message} msg -  The message
     */

  }, {
    key: 'sendMessage',
    value: function sendMessage(channel, msg) {
      // checkParameter(msg)
      if (!this.channels[channel]) {
        log('The channel is not a suscribed channel !');
      }
      this.channels[channel].socket.publish(msg);
    }

    /**
     * This function stores the RSAExchangeEncKey in the current masq-sync
     * instance to en/decrypt the exchanged of the RSA public keys during
     * pairing operation/communications.
     *
     * @param {string} RSAExchangeEncKey - The hexadecimal string of the symmetric key (128bits)
     */

  }, {
    key: 'saveRSAExchangeEncKey',
    value: function saveRSAExchangeEncKey(RSAExchangeEncKey) {
      this.RSAExchangeEncKey = _masqCrypto2.default.utils.hexStringToBuffer(RSAExchangeEncKey);
    }

    /**
     * Send the long term public key, encrypted with an ephemeral
     * symmetric key (exchanged through another channel)
     * @param {Object} params - The public key parameters
     * @param {string} params.publicKey - The public key
     * @param {string} params.symmetricKey - The hexadecimal string of the symmetric key (128bits)
     * @param {boolean} params.ack - Indicate if this is a response to a previous event
     */

  }, {
    key: 'sendRSAPublicKey',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(params) {
        var cipherAES, encPublicKey, msg;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                /**
                 * The symmetric key is given as parameter on the device which
                 * asks the pairing.
                 * The paired device generates the symmetric key must call
                 * saveRSAExchangeEncKey method before sending the QRCOde or pairing link
                 */

                if (params.symmetricKey) {
                  this.RSAExchangeEncKey = _masqCrypto2.default.utils.hexStringToBuffer(params.symmetricKey);
                }

                if (!(!params.symmetricKey && !this.RSAExchangeEncKey)) {
                  _context2.next = 3;
                  break;
                }

                throw new Error('The ephemeral AES encryption key used to encrypt RSA public keys during pairing operation is not known.');

              case 3:
                cipherAES = new _masqCrypto2.default.AES({
                  mode: _masqCrypto2.default.aesModes.GCM,
                  key: params.symmetricKey ? _masqCrypto2.default.utils.hexStringToBuffer(params.symmetricKey) : this.RSAExchangeEncKey,
                  keySize: 128
                });
                _context2.next = 6;
                return cipherAES.encrypt(params.publicKey);

              case 6:
                encPublicKey = _context2.sent;

                // Todo remove + this.ID to the key
                msg = {
                  from: this.ID,
                  event: 'publicKey',
                  data: { key: encPublicKey },
                  to: params.to,
                  ack: params.ack
                };

                this.sendMessage(msg.to, msg);

              case 9:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function sendRSAPublicKey(_x) {
        return _ref2.apply(this, arguments);
      }

      return sendRSAPublicKey;
    }()

    /**
     * Send the EC public key along with associated signature
     * @param {Object} params - The EC public key exchange parameters
     * @param {string} params.to - The channel name
     * @param {string} params.ECPublicKey - The EC public key
     * @param {string} params.signature - The signature of the EC public key
     * @param {boolean} ack - Indicate if this is a response to a previous event
     */

  }, {
    key: 'sendECPublicKey',
    value: function sendECPublicKey(params) {
      // genECPublicKeys()
      // encrypt EC public key
      var msg = {
        from: this.ID,
        event: 'ECPublicKey',
        to: params.to,
        ack: params.ack,
        data: {
          key: params.ECPublicKey + this.ID,
          signature: params.signature
        }
      };
      this.sendMessage(msg.to, msg);
    }

    /**
     * Send the group channel key, encrypted with common derived secret key (ECDH)
     * @param {Object} params - The EC public key exchange parameters
     * @param {string} params.to - The channel name
     * @param {string} params.groupkey - The group key
     */

  }, {
    key: 'sendChannelKey',
    value: function sendChannelKey(params) {
      // TODO encrypt
      var msg = {
        to: params.to,
        event: 'channelKey',
        from: this.ID,
        data: { key: params.groupkey }
      };
      this.sendMessage(msg.to, msg);
    }
  }, {
    key: 'readyToTransfer',
    value: function readyToTransfer(channel) {
      var msg = {
        event: 'readyToTransfer',
        from: this.ID
      };
      this.sendMessage(channel, msg);
    }
  }, {
    key: 'storeRSAPublicKey',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(msg) {
        var cipherAES, decPublicKey;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                cipherAES = new _masqCrypto2.default.AES({
                  mode: _masqCrypto2.default.aesModes.GCM,
                  key: this.RSAExchangeEncKey,
                  keySize: 128
                });
                _context3.next = 3;
                return cipherAES.decrypt(msg.data.key);

              case 3:
                decPublicKey = _context3.sent;

                console.log(decPublicKey);

                // let device = {
                //   name: 'name',
                //   RSAPublicKey: decPublicKey,
                //   isSynched: true
                // }
                // await this.masqStore.addPairedDevice(device)

              case 5:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function storeRSAPublicKey(_x2) {
        return _ref3.apply(this, arguments);
      }

      return storeRSAPublicKey;
    }()
  }, {
    key: 'storeECPublicKey',
    value: function storeECPublicKey(msg) {}
  }, {
    key: 'deriveSecretKey',
    value: function deriveSecretKey() {
      return 'derivedSymmetricKey';
    }
  }, {
    key: 'receiveData',
    value: function receiveData(msg) {
      // decrypt
      this.emit('channelKey', { key: msg.data.key, from: msg.from });
    }
  }, {
    key: 'verifyReceivedECPublicKey',
    value: function verifyReceivedECPublicKey(msg) {
      return true;
    }
  }, {
    key: 'handleRSAPublicKey',
    value: function handleRSAPublicKey(msg) {
      this.storeRSAPublicKey(msg);
      this.emit('RSAPublicKey', { key: msg.data.key, from: msg.from });
      if (msg.ack) {
        return;
      }
      // If initial request, send the RSA public key
      var params = {
        to: msg.from,
        publicKey: 'RSAPublicKey',
        ack: true
      };
      this.sendRSAPublicKey(params);
    }
  }, {
    key: 'handleECPublicKey',
    value: function handleECPublicKey(msg) {
      if (!this.verifyReceivedECPublicKey(msg.data)) {
        // TODO send an error
        console.log('error');
        return;
      }
      this.storeECPublicKey(msg);
      if (msg.ack) {
        this.emit('initECDH', { key: this.deriveSecretKey(), from: msg.from });
        this.readyToTransfer(msg.from);
      } else {
        // If initial request, send EC public key
        var params = {
          to: msg.from,
          ECPublicKey: 'ECPublicKey',
          signature: 'signature',
          ack: true
        };
        this.sendECPublicKey(params);
      }
    }

    /**
     * Subscribe this client to its own channel.
     *
     * @return  {object} The WebSocket client
     */

  }, {
    key: 'subscribeSelf',
    value: function subscribeSelf() {
      var _this3 = this;

      this.myChannel = this.socket.subscribe(this.ID);

      this.myChannel.watch(function (msg) {
        log('****** RECEIVE ******');
        log('From ' + msg.from + ' : ' + msg);
        log('****** RECEIVE ******');

        if (msg.from === _this3.ID) return;
        if (msg.from) {
          // log(`New msg in my channel:`, msg)
          if (msg.event === 'ping') {
            var data = {
              event: 'pong',
              from: _this3.ID
            };
            if (!_this3.channels[msg.from]) {
              // Subscribe to that user
              _this3.channels[msg.from] = {
                socket: _this3.socket.subscribe(msg.from)
              };
            }
            _this3.channels[msg.from].socket.publish(data);
            // log('Channel up with ' + msg.from)
          }
          if (msg.event === 'ECPublicKey') {
            _this3.handleECPublicKey(msg);
          }
          if (msg.event === 'readyToTransfer') {
            _this3.emit('initECDH', { key: _this3.deriveSecretKey(), from: msg.from });
          }
          if (msg.event === 'channelKey') {
            _this3.receiveData(msg);
          }
          if (msg.event === 'publicKey') {
            _this3.handleRSAPublicKey(msg);
          }
        }
      });
    }
    /**
     * Subscribe peer to a given channel.
     *
     * @param   {string} peer A peer (device)
     * @param   {boolean} batch Whether to batch requests for increased perfomance
     * @return  {Promise} Promise resolves/rejects upon subscription or errors
     */

  }, {
    key: 'subscribePeer',
    value: function subscribePeer(peer) {
      var _this4 = this;

      var batch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      return new Promise(function (resolve, reject) {
        if (!peer || peer.length === 0) {
          return reject(new Error('Invalid peer value'));
        }
        _this4.channels[peer] = {
          socket: _this4.socket.subscribe(peer, {
            batch: batch
          })
        };
        _this4.channels[peer].socket.on('subscribe', function () {
          _this4.channels[peer].socket.publish({
            event: 'ping',
            from: _this4.ID
          });
          return resolve();
        });
        _this4.channels[peer].socket.on('subscribeFail', function () {
          return reject(new Error('Subscribe failed'));
        });
      });
    }

    /**
     * Subscribe a list of peers to a given channel.
     *
     * @param   {array} peers List of peers (devices)
     * @return  {Promise} Promise resolves/rejects upon subscription or errors
     */

  }, {
    key: 'subscribePeers',
    value: function subscribePeers() {
      var _this5 = this;

      var peers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      if (!Array.isArray(peers)) {
        return Promise.reject(new Error('Invalid peer list'));
      }
      var pending = [];
      peers.forEach(function (peer) {
        var sub = _this5.subscribePeer(peer, true);
        sub.catch(function () {
          // do something with err
        });
        pending.push(sub);
      });
      return Promise.all(pending);
    }

    /**
     * Unsubscribe peer from a given channel.
     *
     * @param   {string} peer A peer (device)
     * @return  {Promise} Promise resolves/rejects upon unsubscription or errors
     */

  }, {
    key: 'unsubscribePeer',
    value: function unsubscribePeer(peer) {
      var _this6 = this;

      return new Promise(function (resolve, reject) {
        if (!peer || peer.length === 0 || _this6.channels[peer] === undefined) {
          return reject(new Error('Invalid peer value'));
        }
        _this6.channels[peer].socket.unsubscribe();
        delete _this6.channels[peer];
        return resolve();
      });
    }

    /**
     * Deterministically elect a master device, by using the first element of a
     * alphabetically ordered list of peers.
     *
     * @param   {array} peers List of peers (devices)
     * @return  {string} The peer ID of the master
     */

  }, {
    key: 'electMaster',
    value: function electMaster() {
      var peers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      peers.push(this.ID);
      peers.sort();
      return peers[0];
    }
  }]);
  return Client;
}(_events2.default);

module.exports.Client = Client;