const utils = require('../src/utils')

// Test Sync server functionality
describe('Utility functions', () => {
  it('isEmpty', (done) => {
    expect(utils.isEmpty({})).toBeTruthy()
    expect(utils.isEmpty({'foo': 'bar'})).toBeFalsy()
    expect(utils.isEmpty('foo')).toBeFalsy()

    const TypeError = () => {
      utils.isEmpty(null)
    }
    expect(TypeError).toThrow()

    expect(utils.isEmpty([])).toBeTruthy()
    expect(utils.isEmpty([1])).toBeFalsy()
    done()
  })
  it('isObject', (done) => {
    expect(utils.isObject({})).toBeTruthy()
    expect(utils.isObject([])).toBeFalsy()
    expect(utils.isObject('')).toBeFalsy()
    expect(utils.isObject(null)).toBeFalsy()
    done()
  })

  it('should create new UID', (done) => {
    const uid = utils.newUID()
    // Since the UID contains only hexa chars, we don't want to see
    // the character X
    expect(uid).not.toContain('x')
    expect(uid).toContain('-')
    // should have exactly 4x dashes
    expect(uid.split('-').length - 1).toEqual(4)
    done()
  })
})
