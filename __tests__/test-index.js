const socketClusterServer = require('socketcluster-server')
const MasqSync = require('../src/index')

const options = {
  hostname: 'localhost',
  port: 8008,
  multiplex: false
}

const DEFAULTURL = 'http://localhost:8000/socketcluster/'

let server
let sockets = []
let peers = {}
const nrPeers = 3

// Start WebSocket server
beforeAll((done) => {
  server = socketClusterServer.listen(options.port)
  server.on('ready', async () => {
    for (let i = 0; i < nrPeers; i++) {
      sockets.push(new MasqSync())
    }
    // each peer has a list of IDs of other peers
    let pending = []
    sockets.forEach((socket) => {
      peers[socket.ID] = sockets.map(peer => peer.ID).filter((peer) => peer !== socket.ID)
      pending.push(socket.init(options))
    })
    Promise.all(pending).then(() => {
      done()
    })
  })
})

// Close sockets & WebSocket server after all tests end
afterAll(() => {
  sockets.forEeach((socket) => socket.destroy())
  // server.close()
})

describe('Bootstrapping tests', () => {
  it('should have connected the server', (done) => {
    expect(server.isReady).toBeTruthy()
    done()
  })

  it('should have connected the clients', (done) => {
    sockets.forEach((socket) => {
      expect(socket.socket.state).toEqual('open')
    })
    done()
  })
})

describe('MasqSync', () => {
  it('should use default options to init', (done) => {
    const configs = [ [], '', null, undefined ]
    configs.forEach(async (cfg) => {
      const socket = new MasqSync()
      await socket.init(cfg)
      expect(socket.socket.clientId).toEqual(DEFAULTURL)
    })
    done()
  })

  it('should fail on invalid init options', (done) => {
    const configs = [ {port: 9999}, {port: 'foo'} ]
    configs.forEach(async (cfg) => {
      try {
        const socket = new MasqSync()
        await socket.init(cfg)
      } catch (err) {
        expect(err.message).toMatch(/invalid/)
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
      } catch (err) {
        expect(err.message).toMatch(/Socket hung up/)
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

  it('should not subscribe to an invalid peer', async (done) => {
    const badValues = [ [], '', null, undefined ]
    badValues.forEach(async (val) => {
      try {
        await sockets[0].subscribePeer(val)
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
        await sockets[0].subscribePeers(val)
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
        // console.log(socket.channels[peer].socket)
        expect(socket.channels[peer].socket.state).toEqual(socket.channels[peer].socket.SUBSCRIBED)
      })
    })
    done()
  })

  it('should receive pings from other peers', (done) => {
    sockets[0].myChannel.watch((msg) => {
      expect(msg.event).toEqual('ping')
      expect(peers[sockets[0].ID]).toContain(msg.from)
      done()
    })
    for (let i = 1; i < nrPeers; i++) {
      peers[sockets[i].ID].forEach((peer) => {
        sockets[i].channels[peer].socket.publish({
          event: 'ping',
          from: sockets[i].ID
        })
      })
    }
  })

  // it('should subscribe to new peers on pings', async (done) => {
  //   try {
  //     const socket = new MasqSync()
  //     // await socket.init(options)
  //     console.log(socket)
  //   } catch (err) {
  //     console.log(err)
  //   }
  //   // socket.init(options).then(() => {
  //   //   console.log(socket)
  //   //   // console.log(socket)
  //   //   done()
  //   // }).catch((err) => {
  //   //   console.log(socket)
  //   //   console.log(err)
  //   //   done()
  //   // })
  //   // expect(socket.socket.state).toEqual('open')

  //   // sockets[0].myChannel.watch((msg) => {
  //   //   expect(msg.event).toEqual('ping')
  //   //   expect(msg.from).toEqual(socket.ID)

  //   //   // socket.close()

  //   //   done()
  //   // })

  //   // await socket.subscribePeer(sockets[0].ID)
  //   // expect(Object.keys(socket.channels).length).toEqual(1)
  // })
})
