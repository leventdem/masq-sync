
const MasqCrypto = jest.genMockFromModule('masq-crypto')

/**
 * Convert ArrayBufffer to ascii
 * ex : Uint8Array [ 98, 111, 110, 106, 111, 117, 114 ] -> "bonjour"
 *
 * @param {ArrayBuffer} bytes
 * @returns {String}
 */
const toString = (bytes) => {
  return String.fromCharCode.apply(null, new Uint8Array(bytes))
}

/**
 * Convert hex String to ArrayBufffer
 * ex : '11a1b2' -> Uint8Array [ 17, 161, 178 ]
 *
 * @param {String} hexString
 * @returns {ArrayBuffer}
 */
const hexStringToBuffer = (hexString) => {
  if (hexString.length % 2 !== 0) {
    throw new Error('Invalid hexString')
  }
  const arrayBuffer = new Uint8Array(hexString.length / 2)

  for (let i = 0; i < hexString.length; i += 2) {
    const byteValue = parseInt(hexString.substr(i, 2), 16)
    if (isNaN(byteValue)) {
      throw new Error('Invalid hexString')
    }
    arrayBuffer[i / 2] = byteValue
  }

  return arrayBuffer
}

/**
 * Convert ascii to ArrayBufffer
 * ex : "bonjour" -> Uint8Array [ 98, 111, 110, 106, 111, 117, 114 ]
 *
 * @param {String} str
 * @returns {ArrayBuffer}
 */
const toArray = (str = '') => {
  let chars = []
  for (let i = 0; i < str.length; ++i) {
    chars.push(str.charCodeAt(i))
  }
  return new Uint8Array(chars)
}

/**
* Convert ArrayBufffer to hex String
* ex : Uint8Array [ 17, 161, 178 ] -> '11a1b2'
*
* @param {ArrayBuffer} bytes
* @returns {String}
*/
const bufferToHexString = (bytes) => {
  if (!bytes) {
    return null
  }
  let hexBytes = []

  for (let i = 0; i < bytes.length; ++i) {
    let byteString = bytes[i].toString(16)
    if (byteString.length < 2) {
      byteString = '0' + byteString
    }
    hexBytes.push(byteString)
  }
  return hexBytes.join('')
}

const aesModes = {
  CBC: 'aes-cbc',
  GCM: 'aes-gcm',
  CTR: 'aes-ctr'
}

class AES {
  constructor (params) {
    this.mode = params.mode || 'aes-gcm'
    this.keySize = params.keySize || 128
    this.IV = params.iv || null
    this.key = params.key || null
    this.length = params.length || 128
    this.additionalData = params.additionalData || ''
  }

  // return an hex strig of input
  encrypt (input) {
    return new Promise((resolve, reject) => {
      console.log('encrypt')
      resolve(bufferToHexString(toArray(input)))
    })
  }

  // return the original text
  decrypt (input) {
    return new Promise((resolve, reject) => {
      console.log('decrypt')
      resolve(toString(hexStringToBuffer(input)))
    })
  }
}

MasqCrypto.AES = AES
MasqCrypto.aesModes = aesModes
module.exports = MasqCrypto
