'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var socketCluster = require('socketcluster-client');
var common = require('masq-common');

var Server = function () {
  function Server(myID) {
    (0, _classCallCheck3.default)(this, Server);

    this.ID = myID || common.generateUUID();
    this.channels = {};
    this.myChannel = undefined;
  }
  /**
   * Create a new socketCluster WebSocket connection.
   *
   * @param   {object} options Optional parameters
   * @return  {object} The WebSocket client
   */


  (0, _createClass3.default)(Server, [{
    key: 'init',
    value: function init(options) {
      var _this = this;

      var self = this;
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
        };
      }

      return new Promise(function (resolve, reject) {
        self.socket = socketCluster.create(options);

        // if (self.ID === 'foo') console.log(self.socket)

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

    // authorized (from) {
    //   let self = this
    // }

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
     * Deterministically elect a master device. The first element of a alphabetically
     * ordered list of peers.
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
  return Server;
}();

module.exports.Server = Server;