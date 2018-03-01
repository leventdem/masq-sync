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
const nrClients = 3

beforeAll(() => {
  server = socketClusterServer.listen(opts.port)
})

// Close listening server after all tests finish
afterAll(() => {
  clients.forEeach((client) => client.destroy())
  server.close()
})

// Test Sync server functionality
describe('Sync Server', () => {
  it('should connect all clients', (done) => {
    for (let i = 0; i < nrClients; i++) {
      const client = new MasqSync()
      clients.push(client.init())
    }
    Promise.all(clients).then(() => {
      done()
    })
  })

  it('should have connected ' + nrClients + ' clients', (done) => {
    expect(clients.length).toEqual(nrClients)
    done()
  })
})
