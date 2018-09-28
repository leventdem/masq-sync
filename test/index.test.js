import socketClusterServer from 'socketcluster-server'
import MasqSync from '../src/index'
// import MasqCrypto from 'masq-crypto'
jest.mock('masq-crypto')

// console.log(MasqCrypto)
// const cipherAES = new MasqCrypto.AES({
//   mode: MasqCrypto.aesModes.GCM,
//   key: 'symKey',
//   keySize: 128
// })
// cipherAES.encrypt('pubKey')
//   .then(res => {
//     console.log(res)
//     return cipherAES.decrypt(res)
//   })
//   .then(res => console.log(res))

const OPTIONS = {
  hostname: 'localhost',
  port: 9009
}

let server
const nrPeers = 3

// Start WebSocket server
beforeAll((done) => {
  server = socketClusterServer.listen(OPTIONS.port)
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

describe('Client should fail to init', async () => {
  it('when the provided server is not reachable', async () => {
    const opts = { hostname: 'localhost', port: 9999 }
    const client = new MasqSync.Client(opts)
    await expect(client.init()).rejects.toBeDefined()
  })
})

// describe('Initial key exchange', () => {
//   it('should join a secret channel', async () => {
//     const channel = 'secretChannel'
//     const client = new MasqSync.Client(OPTIONS)
//     await client.init()
//     await client.subscribePeer(channel)
//     expect(Object.keys(client.channels)).toContain(channel)
//     client.channels[channel].socket.destroy()
//   })

//   // it('2 clients should exchange their public keys : c1 initiates the exchange', async (done) => {
//   //   const OPT = {
//   //     hostname: 'localhost',
//   //     port: 9009
//   //   }
//   //   const idPeer1 = 'peer1'
//   //   OPT.id = idPeer1
//   //   const c1 = new MasqSync.Client(OPT)
//   //   const idPeer2 = 'peer2'
//   //   OPT.id = idPeer2
//   //   const c2 = new MasqSync.Client(OPT)

//   //   await Promise.all([
//   //     c1.init(),
//   //     c2.init()
//   //   ])
//   //   await c1.subscribePeer(idPeer2)
//   //   c1.on('RSAPublicKey', (key) => {
//   //     // console.log(` Signal peer1 : from ${key.from} : ${key.key}`)
//   //     expect(key.from).toBe(idPeer2)
//   //     expect(key.key).toBe('RSAPublicKey' + idPeer2)

//   //     c1.socket.destroy()
//   //     console.log(c1.socket)

//   //     // console.log((c1.myChannel.client.channels))
//   //     // console.log(Object.keys(c1.myChannel))
//   //     // console.log(Object.keys(c1.channels))
//   //     // console.log(c1.channels[idPeer2])
//   //     c1.socket.destroy()
//   //     c2.socket.destroy()

//   //     done()
//   //   })
//   //   c2.on('RSAPublicKey', (key) => {
//   //     // console.log(` Signal peer2 : from ${key.from} : ${key.key}`)
//   //     expect(key.from).toBe(idPeer1)
//   //     expect(key.key).toBe('RSAPublicKey' + idPeer1)
//   //   })
//   //   c1.exchangeKeys(idPeer2, 'symKey1', 'RSAPublicKey')
//   // })
//   // it('2 clients should exchange their public keys : c2 initiates the exchange', async (done) => {
//   //   const idPeer1 = 'peer01'
//   //   OPTIONS.id = idPeer1
//   //   const c1 = new MasqSync.Client(OPTIONS)
//   //   const idPeer2 = 'peer02'
//   //   OPTIONS.id = idPeer2
//   //   const c2 = new MasqSync.Client(OPTIONS)
//   //   delete OPTIONS.id

//   //   await Promise.all([
//   //     c1.init(),
//   //     c2.init(),
//   //     c1.subscribePeer(idPeer2),
//   //     c2.subscribePeer(idPeer1)
//   //   ])
//   //   c1.on('RSAPublicKey', (key) => {
//   //     console.log(` Signal peer1 : from ${key.from} : ${key.key}`)
//   //     expect(key.from).toBe(idPeer2)
//   //     expect(key.key).toBe('RSAPublicKey' + idPeer2)
//   //   })
//   //   c2.on('RSAPublicKey', (key) => {
//   //     console.log(` Signal peer2 : from ${key.from} : ${key.key}`)
//   //     expect(key.from).toBe(idPeer1)
//   //     expect(key.key).toBe('RSAPublicKey' + idPeer1)
//   //     done()
//   //   })
//   //   c2.exchangeKeys(idPeer1, 'symKey1', 'RSAPublicKey')
//   // })
// })

describe('Peers', () => {
  let clients = []
  let peers = {}

  beforeAll((done) => {
    for (let i = 0; i < nrPeers; i++) {
      clients.push(new MasqSync.Client(OPTIONS))
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
    const client = new MasqSync.Client(OPTIONS)
    await client.init()
    await client.subscribePeer(clients[0].ID)

    expect(Object.keys(client.channels).length).toEqual(1)

    console.log(Object.keys(client.channels))
    // wait a bit for the other clients to sub
    await new Promise(resolve => setTimeout(resolve, 300))
    console.log('2.0', Object.keys(clients[0].channels))
    console.log('coucou')

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
