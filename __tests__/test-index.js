const socketClusterServer = require('socketcluster-server')
const MasqSync = require('../src/index')

const opts = {
  hostname: 'localhost',
  port: 8008
}

let server
let sockets = []
let peers = {}
const nrPeers = 3

// Start WebSocket server
beforeAll(() => {
  return new Promise((resolve) => {
    server = socketClusterServer.listen(opts.port)
    server.on('ready', async () => {
      for (let i = 0; i < nrPeers; i++) {
        sockets.push(new MasqSync())
      }
      // each peer has a list of IDs of other peers
      sockets.forEach(async (socket) => {
        peers[socket.ID] = sockets.map(peer => peer.ID).filter((peer) => peer !== socket.ID)
        await socket.init(opts)
        console.log('State:', socket.socket)
      })
      return resolve()
    })
  })
})

// Close sockets & WebSocket server after all tests end
afterAll(() => {
  sockets.forEeach((socket) => socket.destroy())
  server.close()
})

describe('Test server', () => {
  it('should be ready', (done) => {
    expect(server.isReady).toBeTruthy()
    done()
  })
})

describe('MasqSync', () => {
  it('should use default options to init', (done) => {
    const configs = [ [], '', null, undefined ]
    configs.forEach(async (cfg) => {
      const socket = new MasqSync()
      await socket.init(cfg)
      expect(socket.socket.clientId).toEqual('http://localhost:8000/socketcluster/')
    })
    done()
  })

  it('should fail on invalid init options', (done) => {
    const configs = [ {port: 9999}, {port: 'foo'} ]
    configs.forEach(async (cfg) => {
      try {
        const socket = new MasqSync()
        await socket.init(cfg)
      } catch (e) {
        expect(e.message).toMatch(/invalid/)
      }
    })
    done()
  })

  it('should not connect to inexistent server', (done) => {
    const configs = [ {hostname: 'localhost', port: 9999} ]
    configs.forEach(async (cfg) => {
      try {
        const socket = new MasqSync()
        await socket.init(cfg)
        expect(socket.socket.state).toEqual(socket.socket.CLOSED)
      } catch (e) {
        expect(e.message).toMatch(/Socket hung up/)
      }
    })
    done()
  })

  it('should connect all peers', (done) => {
    expect(sockets.length).toEqual(nrPeers)
    done()
  })
})

describe('Peers', () => {
  it('should be able to elect a master peer', (done) => {
    const ids = sockets.map(socket => socket.ID)

    let master = sockets[1].electMaster(ids)
    expect(master).toEqual(ids.sort()[0])

    master = sockets[1].electMaster()
    expect(master).toEqual(sockets[1].ID)

    done()
  })

  it('should not subscribe to an invalid peer', (done) => {
    const badValues = [ [], '', null, undefined ]
    badValues.forEach(async (val) => {
      try {
        await sockets[0].subscribePeer(val)
      } catch (e) {
        expect(e.message).toMatch(/invalid/i)
      }
    })
    done()
  })

  it('should not subscribe to an empty list of peers', async (done) => {
    await sockets[0].subscribePeers()
    expect(Object.keys(sockets[0].channels).length).toEqual(0)

    const badValues = [ [null, undefined], '', null, undefined ]
    badValues.forEach(async (val) => {
      try {
        await sockets[0].subscribePeers(val)
      } catch (e) {
        expect(e.message).toMatch(/invalid/i)
      }
      expect(Object.keys(sockets[0].channels).length).toEqual(0)
    })

    done()
  })

  it('should subscribe to other peers', (done) => {
    sockets.forEach(async (socket) => {
      await socket.subscribePeers(peers[socket.ID])
      expect(Object.keys(socket.channels).length).toEqual(nrPeers - 1)
    })
    done()
  })

  it('each peer should have individual channels with other peers', (done) => {
    sockets.forEach((socket) => {
      peers[socket.ID].forEach((peer) => {
        expect(socket.channels[peer]).not.toBeUndefined()
        expect(socket.channels[peer].socket.state).toEqual(socket.channels[peer].socket.SUBSCRIBED)
      })
    })
    done()
  })

  // it('should receive pings from other peers', async (done) => {
  //   sockets[1].myChannel.watch((msg) => {
  //     expect(msg.event).toEqual('ping')
  //     expect(msg.from).toEqual(sockets[0].ID)
  //     done()
  //   })
  //   sockets[0].channels[sockets[1].ID].socket.publish({
  //     event: 'ping',
  //     from: sockets[0].ID
  //   })
  // })

  // it('should subscribe to new peers on pings', async (done) => {
  //   const socket = new MasqSync()
  //   await socket.init(opts)

  //   sockets[0].myChannel.watch((msg) => {
  //     expect(msg.event).toEqual('ping')
  //     expect(msg.from).toEqual(socket.ID)

  //     socket.close()

  //     done()
  //   })

  //   socket.subscribePeer(sockets[0].ID).then(() => {
  //     expect(Object.keys(socket.channels).length).toEqual(1)
  //   })
  // })
})
