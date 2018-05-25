const socketClusterServer = require('socketcluster-server')
const MasqSync = require('../src/index')

const options = {
  hostname: 'localhost',
  port: 8008
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
  it('should have connected the server', () => {
    expect(server.isReady).toBeTruthy()
  })
})

describe('MasqSync.Client should failt to init', async () => {
  it('when none are provided', async () => {
    const client = new MasqSync.Client()
    await expect(client.init()).rejects.toBeDefined()
  })

  it('when provided server is not reachable or is down', async () => {
    const opts = {hostname: 'localhost', port: 9999}
    const client = new MasqSync.Client(opts)
    await expect(client.init()).rejects.toBeDefined()
  })
})

describe('Peers', () => {
  let clients = []
  let peers = {}

  beforeAll((done) => {
    for (let i = 0; i < nrPeers; i++) {
      clients.push(new MasqSync.Client(options))
    }
    // each peer has a list of IDs of other peers
    let pending = []
    clients.forEach((client) => {
      peers[client.ID] = clients.map(peer => peer.ID).filter((peer) => peer !== client.ID)
      const prom = client.init()
      pending.push(prom)
    })
    Promise.all(pending).then(() => {
      done()
    })
  })

  // Close clients & server after all tests end
  // afterAll(() => {
  //   clients.forEeach((client) => client.destroy())
  // })

  it('should be able to elect a master peer', () => {
    const ids = clients.map(client => client.ID)

    let master = clients[1].electMaster(ids)
    expect(master).toEqual(ids.sort()[0])

    master = clients[1].electMaster()
    expect(master).toEqual(clients[1].ID)
  })

  it('should not subscribe to an invalid peer', async () => {
    const badValues = [ [], '', null, undefined ]
    badValues.forEach(async (val) => {
      await expect(clients[0].subscribePeer(val)).rejects.toBeDefined()
    })
  })

  it('should not subscribe to an empty list of peers', async () => {
    await clients[0].subscribePeers()
    expect(Object.keys(clients[0].channels).length).toEqual(0)
  })
  
  it('should subscribe to other peers', async () => {
    clients.forEach(async (client) => {
      await client.subscribePeers(peers[client.ID])
      expect(Object.keys(client.channels).length).toEqual(nrPeers - 1)

      peers[client.ID].forEach((peer) => {
        expect(client.channels[peer]).not.toBeUndefined()
        expect(client.channels[peer].socket.state).toEqual(client.channels[peer].socket.SUBSCRIBED)
      })
    })
  })

  it('should subscribe to new peers on pings', async () => {
    const client = new MasqSync.Client(options)
    await client.init()
    await client.subscribePeer(clients[0].ID)

    expect(Object.keys(client.channels).length).toEqual(1)

    // wait a bit for the other clients to sub
    await new Promise(resolve => setTimeout(resolve, 100))

    // check that the new client ID is listed in the previous ones
    expect(Object.keys(clients[0].channels).length).toEqual(3)
    expect(Object.keys(clients[0].channels)).toContain(client.ID)
    // clean2up
    await clients[0].unsubscribePeer(client.ID)
  })

  it('should unsubscribe peer on demand', async () => {
    const ID = 'foo'

    await clients[0].subscribePeer(ID)
    expect(Object.keys(clients[0].channels)).toContain(ID)
    expect(Object.keys(clients[0].channels).length).toEqual(3)

    await clients[0].unsubscribePeer(ID)
    expect(Object.keys(clients[0].channels).length).toEqual(2)
    expect(Object.keys(clients[0].channels)).not.toContain(ID)
  })

  it('should fail to unsubscribe bad peers', async () => {
    const badValues = [ 'foo', '', null, undefined ]
    badValues.forEach(async (val) => {
      await expect(clients[0].unsubscribePeer(val)).rejects.toBeDefined()
      expect(Object.keys(clients[0].channels).length).toEqual(2)
    })
  })
})
