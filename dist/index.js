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

    this.options = DEFAULTS;
    if (options && options.hostname) {
      this.options.hostname = options.hostname;
    }
    if (options && options.port) {
      this.options.port = options.port;
    }
    if (options && options.autoReconnectOptions) {
      this.options.autoReconnectOptions = options.autoReconnectOptions;
    }
    if (options && options.id) {
      this.options.id = options.id;
    }
    if (options && options.multiplex) {
      this.options.multiplex = options.multiplex;
    }
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

      var self = this;

      return new Promise(function (resolve, reject) {
        self.socket = new _socketclusterClient2.default.create(self.options);

        self.socket.on('error', function (err) {
          return reject(err);
        });

        self.socket.on('close', function (err) {
          return reject(err);
        });

        self.socket.on('connect', (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
          return _regenerator2.default.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _context.next = 2;
                  return self.subscribeSelf();

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
     * Subscribe this client to its own channel.
     *
     * @return  {object} The WebSocket client
     */

  }, {
    key: 'subscribeSelf',
    value: function subscribeSelf() {
      var self = this;

      self.myChannel = self.socket.subscribe(self.ID);
      self.myChannel.watch(function (msg) {
        if (msg.from) {
          // console.log(`New msg in my channel:`, msg)
          if (msg.event === 'ping') {
            var data = {
              event: 'pong',
              from: self.ID
            };
            if (!self.channels[msg.from]) {
              // Subscribe to that user
              self.channels[msg.from] = {
                socket: self.socket.subscribe(msg.from)
              };
            }
            self.channels[msg.from].socket.publish(data);
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
      var _this2 = this;

      var batch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      return new Promise(function (resolve, reject) {
        if (!peer || peer.length === 0) {
          return reject(new Error('Invalid peer value'));
        }
        var self = _this2;
        self.channels[peer] = {
          socket: self.socket.subscribe(peer, {
            batch: batch
          })
        };
        self.channels[peer].socket.on('subscribe', function () {
          self.channels[peer].socket.publish({
            event: 'ping',
            from: self.ID
          });
          return resolve();
        });
        self.channels[peer].socket.on('subscribeFail', function () {
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
      var peers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

      if (!Array.isArray(peers)) {
        return Promise.reject(new Error('Invalid peer list'));
      }
      var self = this;
      var pending = [];
      peers.forEach(function (peer) {
        var sub = self.subscribePeer(peer, true);
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
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        var self = _this3;
        if (!peer || peer.length === 0 || self.channels[peer] === undefined) {
          return reject(new Error('Invalid peer value'));
        }
        self.channels[peer].socket.unsubscribe();
        delete self.channels[peer];
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

      var self = this;
      peers.push(self.ID);
      peers.sort();
      return peers[0];
    }
  }]);
  return Client;
}();

module.exports.Client = Client;