const socketClusterServer = require('socketcluster-server')
const MasqSync = require('../src/index')

const options = {
  hostname: 'localhost',
  port: 8008,
  multiplex: false
}

const DEFAULTURL = 'http://localhost:8000/socketcluster/'

let server
const nrPeers = 3

// Start WebSocket server
beforeAll((done) => {
  server = socketClusterServer.listen(options.port)
  server.on('closure', () => {})
  server.on('disconnection', () => {})
  server.once('ready', () => {
    done()
  })
})

// Close sockets & WebSocket server after all tests end
afterAll(() => {
  server.close()
})

describe('Bootstrapping tests', () => {
  it('should have connected the server', (done) => {
    expect(server.isReady).toBeTruthy()
    done()
  })
})

describe('MasqSync init', () => {
  it('should use default options when none are provided', (done) => {
    const configs = [ [], '', null, undefined ]
    configs.forEach(async (cfg) => {
      const socket = new MasqSync()
      await socket.init(cfg)
      expect(socket.socket.clientId).toEqual(DEFAULTURL)
    })
    done()
  })

  it('should fail on invalid options', (done) => {
    const configs = [ {port: 9999}, {port: 'foo'} ]
    configs.forEach(async (cfg) => {
      let prom
      try {
        const socket = new MasqSync()
        prom = socket.init(cfg)
        prom.catch(() => {})
      } catch (err) {
        expect(err.message).toMatch(/invalid/)
      }
    })
    done()
  })

  it('should not connect to inexistent server', (done) => {
    const configs = [ {hostname: 'localhost', port: 9999} ]
    configs.forEach(async (cfg) => {
      let prom
      try {
        const socket = new MasqSync()
        prom = socket.init(cfg)
        prom.then(() => {
          expect(socket.socket.state).toEqual(socket.socket.CLOSED)
        }).catch(() => {})
      } catch (err) {
        expect(prom).rejects.toHaveProperty('message', 'Socket hung up')
      }
    })
    done()
  })
})

describe('Peers', () => {
  let sockets = []
  let peers = {}

  beforeAll((done) => {
    for (let i = 0; i < nrPeers; i++) {
      sockets.push(new MasqSync())
    }
    // each peer has a list of IDs of other peers
    let pending = []
    sockets.forEach((socket) => {
      peers[socket.ID] = sockets.map(peer => peer.ID).filter((peer) => peer !== socket.ID)
      const prom = socket.init(options)
      pending.push(prom)
    })
    Promise.all(pending).then(() => {
      done()
    })
  })

  // Close sockets & WebSocket server after all tests end
  afterAll(() => {
    sockets.forEeach((socket) => socket.destroy())
  })

  it('should be able to elect a master peer', (done) => {
    const ids = sockets.map(socket => socket.ID)

    let master = sockets[1].electMaster(ids)
    expect(master).toEqual(ids.sort()[0])

    master = sockets[1].electMaster()
    expect(master).toEqual(sockets[1].ID)

    done()
  })

  it('should not subscribe to an invalid peer', async (done) => {
    const badValues = [ [], '', null, undefined ]
    badValues.forEach(async (val) => {
      try {
        const prom = sockets[0].subscribePeer(val)
        prom.catch(() => {})
        await prom
      } catch (err) {
        expect(err.message).toMatch(/invalid/i)
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
        const prom = sockets[0].subscribePeers(val)
        prom.catch(() => {})
        await prom
      } catch (err) {
        expect(err.message).toMatch(/invalid/i)
      }
      expect(Object.keys(sockets[0].channels).length).toEqual(0)
    })

    done()
  })

  it('should subscribe to other peers', async (done) => {
    sockets.forEach(async (socket) => {
      await socket.subscribePeers(peers[socket.ID])
      expect(Object.keys(socket.channels).length).toEqual(nrPeers - 1)

      peers[socket.ID].forEach((peer) => {
        expect(socket.channels[peer]).not.toBeUndefined()
        expect(socket.channels[peer].socket.state).toEqual(socket.channels[peer].socket.SUBSCRIBED)
      })
    })
    done()
  })

  it('should subscribe to new peers on pings', async (done) => {
    const socket = new MasqSync()
    await socket.init(options)
    await socket.subscribePeer(sockets[0].ID)

    expect(Object.keys(socket.channels).length).toEqual(1)
    setTimeout(async () => {
      expect(Object.keys(sockets[0].channels).length).toEqual(3)
      expect(Object.keys(sockets[0].channels)).toContain(socket.ID)
      // cleanup
      await sockets[0].unsubscribePeer(socket.ID)
      done()
    }, 10)
  })

  it('should unsubscribe on demand', async (done) => {
    const ID = 'foo'

    await sockets[0].subscribePeer(ID)
    expect(Object.keys(sockets[0].channels)).toContain(ID)
    expect(Object.keys(sockets[0].channels).length).toEqual(3)

    await sockets[0].unsubscribePeer(ID)
    expect(Object.keys(sockets[0].channels).length).toEqual(2)
    expect(Object.keys(sockets[0].channels)).not.toContain(ID)

    done()
  })

  it('should failt to unsubscribe bad peers', async (done) => {
    const badValues = [ 'foo', '', null, undefined ]
    badValues.forEach(async (val) => {
      try {
        const prom = sockets[0].unsubscribePeer(val)
        prom.catch(() => {})
        await prom
      } catch (err) {
        expect(err.message).toMatch(/invalid/i)
      }
      expect(Object.keys(sockets[0].channels).length).toEqual(2)
    })

    done()
  })
})
