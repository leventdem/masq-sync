const socketClusterServer = require('socketcluster-server')
const MasqSync = require('../src/index')

let opts = {
  hostname: 'localhost',
  port: 8008,
  autoReconnectOptions: {
    randomness: 1000,
    multiplier: 1.5,
    maxDelay: 7000
  }
}

let server
let clients = []
let peers = {}
const nrClients = 3

beforeAll(() => {
  server = socketClusterServer.listen(opts.port)
})

// Close listening server after all tests finish
afterAll(() => {
  clients.forEeach((client) => client.destroy())
  server.close()
})

describe('MasqSync', () => {
  it('should connect all clients', (done) => {
    let promises = []
    for (let i = 0; i < nrClients; i++) {
      const client = new MasqSync()
      clients.push(client)
      promises.push(client.init())
    }
    // each client has a list of IDs of other peers
    clients.forEach((client) => {
      peers[client.ID] = clients.map(peer => peer.ID).filter((peer) => peer !== client.ID)
    })
    Promise.all(promises).then(() => {
      done()
    })
  })

  it('should have connected ' + nrClients + ' clients', (done) => {
    expect(clients.length).toEqual(nrClients)
    done()
  })

  it('should elect a master peer', (done) => {
    const ids = clients.map(client => client.ID)

    const master = clients[0].electMaster(ids)
    ids.sort()
    expect(master).toEqual(ids[0])
    done()
  })

  it('should subscribe to other peers', (done) => {
    let promises = []
    clients.forEach((client) => {
      promises.push(client.subscribeToPeers(peers[client.ID]))
    })
    Promise.all(promises).then(() => {
      clients.forEach((client) => {
        expect(Object.keys(client.channels).length).toEqual(nrClients - 1)
      })
      done()
    })
  })

  it('each peer should have individual channels with other peers', (done) => {
    clients.forEach((client) => {
      peers[client.ID].forEach((peer) => {
        expect(client.channels[peer]).not.toBeUndefined()
        // expect(client.channels[peer].intro).toBeTruthy()
      })
    })
    done()
  })
})
