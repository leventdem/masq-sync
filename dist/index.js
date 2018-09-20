'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _socketclusterClient = require('socketcluster-client');

var _socketclusterClient2 = _interopRequireDefault(_socketclusterClient);

var _masqCommon = require('masq-common');

var _masqCommon2 = _interopRequireDefault(_masqCommon);

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

  /**
   * Client class.
   *
   * @param  {Object} options List of constructor parameters
   */
};
var Client = function () {
  function Client(options) {
    (0, _classCallCheck3.default)(this, Client);

    // override default options
    this.options = Object.assign(DEFAULTS, options);
    this.ID = this.options.id || _masqCommon2.default.generateUUID();
    this.channels = {};
    this.socket = undefined;
    this.myChannel = undefined;
  }

  /**
   * Init a new socketClient connection.
   *
   * @return  {Promise} Promise resolves/rejects upon connection or errors
   */


  (0, _createClass3.default)(Client, [{
    key: 'init',
    value: function init() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this.socket = _socketclusterClient2.default.create(_this.options);

        _this.socket.on('error', function (err) {
          return reject(err);
        });

        _this.socket.on('close', function (err) {
          return reject(err);
        });

        _this.socket.on('connect', (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
          return _regenerator2.default.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _context.next = 2;
                  return _this.subscribeSelf();

                case 2:
                  return _context.abrupt('return', resolve());

                case 3:
                case 'end':
                  return _context.stop();
              }
            }
          }, _callee, _this);
        })));
      });
    }

    /**
     * Join another peer, by exchanging public keys
     * through a secret channel, encrypted with a symmetric key
     */

  }, {
    key: 'exchangeKeys',
    value: function exchangeKeys(secretChannel, symKey, pubKey) {
      var _this2 = this;

      return new Promise(function () {
        var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(resolve, reject) {
          var ch, cipherAES, encPublicKey, publishReady, publishKey;
          return _regenerator2.default.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  // TODO: check params
                  ch = _this2.socket.subscribe(secretChannel);

                  _this2.channels[secretChannel] = ch;

                  cipherAES = new _masqCrypto2.default.AES({
                    mode: _masqCrypto2.default.aesModes.GCM,
                    key: symKey,
                    keySize: 128
                  });
                  _context3.next = 5;
                  return cipherAES.encrypt(pubKey);

                case 5:
                  encPublicKey = _context3.sent;

                  publishReady = function publishReady() {
                    return ch.publish({ event: 'ready', from: _this2.ID });
                  };
                  // Send our key through the channel
                  // TODO: generate key and encrypt it with symKey


                  publishKey = function publishKey() {
                    return ch.publish({ event: 'publicKey', from: _this2.ID, key: encPublicKey });
                  };

                  publishReady();

                  ch.watch(function () {
                    var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(msg) {
                      var decPublicKey;
                      return _regenerator2.default.wrap(function _callee2$(_context2) {
                        while (1) {
                          switch (_context2.prev = _context2.next) {
                            case 0:
                              if (!(msg.from === _this2.ID)) {
                                _context2.next = 2;
                                break;
                              }

                              return _context2.abrupt('return');

                            case 2:
                              if (!(msg.event === 'ready')) {
                                _context2.next = 4;
                                break;
                              }

                              return _context2.abrupt('return', publishKey());

                            case 4:
                              if (!(msg.event === 'publicKey')) {
                                _context2.next = 14;
                                break;
                              }

                              if (!(!msg.from || !msg.key)) {
                                _context2.next = 7;
                                break;
                              }

                              return _context2.abrupt('return');

                            case 7:
                              _context2.next = 9;
                              return cipherAES.decrypt(pubKey);

                            case 9:
                              decPublicKey = _context2.sent;

                              _this2.socket.unsubscribe(secretChannel);
                              delete _this2.channels[secretChannel];
                              publishKey();
                              resolve({
                                from: msg.from,
                                event: msg.event,
                                key: decPublicKey
                              });

                            case 14:
                            case 'end':
                              return _context2.stop();
                          }
                        }
                      }, _callee2, _this2);
                    }));

                    return function (_x3) {
                      return _ref3.apply(this, arguments);
                    };
                  }());

                case 10:
                case 'end':
                  return _context3.stop();
              }
            }
          }, _callee3, _this2);
        }));

        return function (_x, _x2) {
          return _ref2.apply(this, arguments);
        };
      }());
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
        if (msg.from) {
          // console.log(`New msg in my channel:`, msg)
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
}();

module.exports.Client = Client;