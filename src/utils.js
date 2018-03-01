/**
 * Returns whether or not an object or array is empty.
 *
 * @param   {*} thing The value to check
 * @returns {bool} Whether or not the object is empoty
 */
export const isEmpty = (thing) => {
  return Object.keys(thing).length === 0
}

/**
 * Returns whether or not the value is an object.
 *
 * @param   {*} obj The value to check
 * @returns {bool} True if the value is an object
 */
export const isObject = (thing) => {
  return Object.prototype.toString.call(thing) === '[object Object]'
}

/**
 * Generate a unique identifier
 *
 * @returns {string} A unique identifier
 */
export const newUID = () => {
  return 'xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (r & 0x3 | 0x8).toString(16)
  })
}
