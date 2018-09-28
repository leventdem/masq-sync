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
// import MasqCrypto from 'masq-crypto'

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
 */

var Client = function (_EventEmitter) {
  (0, _inherits3.default)(Client, _EventEmitter);

  function Client(options) {
    (0, _classCallCheck3.default)(this, Client);

    // override default options
    var _this = (0, _possibleConstructorReturn3.default)(this, (Client.__proto__ || Object.getPrototypeOf(Client)).call(this));

    _this.options = Object.assign(DEFAULTS, options);
    _this.ID = _this.options.id || _masqCommon2.default.generateUUID();
    _this.channels = {};
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
        _this2.setWatchers();

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
      if (!this.channels[channel]) {
        log('The channel is not a suscribed channel !');
      }
      this.channels[channel].socket.publish(msg);
    }

    /**
     * Exchanging public keys
     * through the other peer channel, encrypted with a symmetric key
     * @param {string} secretChannel - The channel name
     * @param {string} symKey - The hexadecimal string of the symmetric key (128bits)
     * @param {string} pubKey - The public key
     * @returns {Promise}
     */

  }, {
    key: 'exchangeKeys',
    value: function exchangeKeys(channel, symKey, pubKey) {
      var msg = {
        from: this.ID,
        event: 'publicKey',
        data: { key: pubKey + this.ID },
        to: channel
      };
      this.sendMessage(msg.to, msg);
    }
  }, {
    key: 'setSymmetricKey',
    value: function setSymmetricKey(channel) {
      var msg = {
        from: this.ID,
        event: 'initEcdh',
        to: channel
      };
      this.sendMessage(msg.to, msg);
    }
  }, {
    key: 'sendData',
    value: function sendData(channel, event, data) {
      var msg = {
        event: 'data',
        from: this.ID,
        data: data
      };
      this.sendMessage(channel, msg);
      log('####### SEND ########');
      log(msg.from + ' encrypts and sends data.');
      log('####### SEND ########');
    }

    /**
     * Set the global watchers
     * Here we init ECDH to send data
     */

  }, {
    key: 'setWatchers',
    value: function setWatchers() {
      if (!this.myChannel) {
        this.myChannel = this.socket.subscribe(this.ID);
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

  }, {
    key: 'subscribeSelf',
    value: function subscribeSelf() {
      var _this3 = this;

      this.myChannel = this.socket.subscribe(this.ID);
      var initEcdhAck = function initEcdhAck(channel) {
        var msg = {
          event: 'initEcdhAck',
          from: _this3.ID,
          publicKey: 'mysecretKey' + _this3.ID.slice(0, 5),
          signature: 'signature'
        };
        _this3.sendMessage(channel, msg);
        log('####### SEND ########');
        log(msg.from + ' sends publickKey and signature.');
        log('####### SEND ########');
      };

      var readyToTransfer = function readyToTransfer(channel) {
        var msg = {
          event: 'readyToTransfer',
          from: _this3.ID,
          data: ' ready'
        };
        _this3.sendMessage(channel, msg);
        log('####### SEND ########');
        log(msg.from + ' sends the final ready signal.');
        log('####### SEND ########');
      };

      var sendPublicKey = function sendPublicKey(channel) {
        var msg = {
          event: 'publicKeyAck',
          from: _this3.ID,
          data: { key: 'RSAPublicKey' + _this3.ID }
        };
        _this3.sendMessage(channel, msg);
        log('####### SEND ########');
        log(msg.from + ' sends her public RSA key.');
        log('####### SEND ########');
      };
      var storePublicKey = function storePublicKey(msg) {
        log('####### RECEIVE ########');
        log('From ' + msg.from + ' : ' + msg.data.key);
        log('####### RECEIVE ########');
        _this3.emit('RSAPublicKey', { key: msg.data.key, from: msg.from });
      };

      var deriveSecretKey = function deriveSecretKey() {
        // log('------ ACTION ------')
        // log(`${from} derives the secret symmetric key`)
        // log('------ ACTION ------')
        return 'derivedSymmetricKey';
      };

      var receiveData = function receiveData(msg) {
        log('------ ACTION ------');
        log(msg.from + ' decrypts data, msg is : ' + msg.data);
        log('------ ACTION ------');
      };

      this.myChannel.watch(function (msg) {
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
          if (msg.event === 'initEcdh') {
            log('****** RECEIVE ******');
            log('From ' + msg.from + ' : ' + Object.keys(msg));
            log('****** RECEIVE ******');
            initEcdhAck(msg.from);
          }

          if (msg.event === 'initEcdhAck') {
            log('****** RECEIVE ******');
            log('From ' + msg.from + ' : ' + Object.keys(msg));
            log('****** RECEIVE ******');
            readyToTransfer(msg.from);
            log('derived Key operation 1: OK', deriveSecretKey());
            _this3.emit('initECDH', deriveSecretKey());
          }
          if (msg.event === 'readyToTransfer') {
            log('****** RECEIVE ******');
            log('From ' + msg.from + ' : readyToTransfer');
            log('****** RECEIVE ******');
            log('derived Key operation 2 : OK', deriveSecretKey());
            _this3.emit('initECDH', deriveSecretKey());
          }
          if (msg.event === 'channelKey') {
            receiveData(msg);
          }
          if (msg.event === 'publicKey') {
            storePublicKey(msg);
            sendPublicKey(msg.from);
          }
          if (msg.event === 'publicKeyAck') {
            storePublicKey(msg);
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