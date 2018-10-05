import socketClusterServer from 'socketcluster-server'
import MasqSync from '../src/index'
jest.mock('masq-crypto')

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

describe('Initial key exchange', () => {
  it('should join a secret channel', async () => {
    const channel = 'secretChannel'
    const client = new MasqSync.Client(OPTIONS)
    await client.init()
    await client.subscribePeer(channel)
    expect(Object.keys(client.channels)).toContain(channel)
    client.channels[channel].socket.destroy()
  })

  it('Should fail during 2 clients public key exchange : c1 initiates the exchange but c2 does not call saveRSAExchangeEncKey after the key generation', async () => {
    expect.assertions(1)
    const peer1Id = 'peer01'

    const peer2 = {
      hostname: 'localhost',
      port: 9009,
      id: 'peer02'
    }
    const c2 = new MasqSync.Client(peer2)
    await c2.init()
    /**
     * We suppose :
     * The pairing function is called in c2, a RSAExchangeEncKey is generated.
     * C1 receives the RSAExchangeEncKey
     * c1 calls sendRSAPublicKey
     * c2 does not receive the symmetric key (as expected)
     * c2 must have stored the symmetric key by calling saveRSAExchangeEncKey
     */
    let resp = {
      to: peer1Id,
      publicKey: 'RSAPublicKey',
      ack: true
    }
    await expect(c2.sendRSAPublicKey(resp)).rejects.toBeDefined()
  })

  it('2 clients should succesfully exchange their public keys : c1 initiates the exchange', async (done) => {
    const peer1 = {
      hostname: 'localhost',
      port: 9009,
      id: 'peer001'
    }
    const peer2 = {
      hostname: 'localhost',
      port: 9009,
      id: 'peer002'
    }
    const c1 = new MasqSync.Client(peer1)
    const c2 = new MasqSync.Client(peer2)

    await Promise.all([
      c1.init(),
      c2.init()
    ])
    await c1.subscribePeer(peer2.id)
    c1.on('RSAPublicKey', async (key) => {
      expect(key.from).toBe(peer2.id)
      expect(key.key).toBe('RSAPublicKey')
      // console.log(` Signal peer1 : from ${key.from} : ${key.key}`)
      expect.assertions(4)
      done()
    })
    c2.on('RSAPublicKey', (key) => {
      expect(key.from).toBe(peer1.id)
      expect(key.key).toBe('RSAPublicKey')
      // console.log(` Signal peer2 : from ${key.from} : ${key.key}`)
    })
    let options = {
      to: peer2.id,
      symmetricKey: '11a1b211a1b211a1b211a1b211a1b2a2',
      publicKey: 'RSAPublicKey',
      ack: false
    }
    c2.saveRSAExchangeEncKey(options.symmetricKey)
    c1.sendRSAPublicKey(options)
  })
})

// describe('ECDHE', () => {
//   it('2 clients should derive a common secret : c1 initiates the exchange', async (done) => {
//     const peer1 = {
//       hostname: 'localhost',
//       port: 9009,
//       id: 'peer1'
//     }
//     const peer2 = {
//       hostname: 'localhost',
//       port: 9009,
//       id: 'peer2'
//     }
//     const c1 = new MasqSync.Client(peer1)
//     const c2 = new MasqSync.Client(peer2)

//     await Promise.all([
//       c1.init(),
//       c2.init()
//     ])
//     await c1.subscribePeer(peer2.id)
//     c1.on('initECDH', (key) => {
//       // console.log(` Signal peer1 : from ${key.from} : ${key.key}`)
//       expect(key.from).toBe(peer2.id)
//       expect(key.key).toBe('derivedSymmetricKey')

//       // TODO : destroy
//       let params = {
//         to: peer2.id,
//         groupkey: 'this is the group key'
//       }
//       c1.sendChannelKey(params)
//     })
//     c2.on('initECDH', (key) => {
//       // console.log(` Signal peer2 : from ${key.from} : ${key.key}`)
//       expect(key.from).toBe(peer1.id)
//       expect(key.key).toBe('derivedSymmetricKey')
//     })
//     c2.on('channelKey', (key) => {
//       // console.log(` Signal channelKey peer2 : from ${key.from} : ${key.key}`)
//       expect(key.from).toBe(peer1.id)
//       expect(key.key).toBe('this is the group key')
//       expect.assertions(6)
//       done()
//     })
//     let params = {
//       from: peer1.id,
//       to: peer2.id,
//       ECPublicKey: 'ECPublicKey',
//       signature: 'signature',
//       ack: false
//     }
//     c1.sendECPublicKey(params)
//   })
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
