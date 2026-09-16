// https://github.com/lucach/meta-png

/**
 * Packs a number into a 4 bytes Uint8Array, treating it as uint32.
 *
 * @param {number} n - The number to convert
 * @returns {Uint8Array} - The array
 */
function packNumberAs4Bytes(n: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint32(0, n)
  return new Uint8Array(view.buffer)
}

/**
 * Encodes a string (UTF-8) into an array of bytes.
 *
 * @param {string} s - The string to encode
 * @returns {Uint8Array} - The resulting array containing the encoded string.
 */
function encodeString(s: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(s)
}

/**
 * Concatenates (joins) a sequence of Uint8Arrays.
 *
 * @param {Uint8Array[]} arrays - An array of Uint8Arrays to be concatenated in order.
 * @returns {Uint8Array} - The resulting concatenated array.
 */
function concatArrays(arrays: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const length = arrays.reduce((prev, array) => prev + array.byteLength, 0)
  const finalArray = new Uint8Array(length)
  for (let i = 0, lenSoFar = 0; i < arrays.length; i += 1) {
    finalArray.set(arrays[i], lenSoFar)
    lenSoFar += arrays[i].byteLength
  }
  return finalArray
}

/**
 * Returns a dataview on the entire the TypedArray/Buffer.
 * We need to be very careful here, because the are subtle incompatibilities
 * between JavaScript TypedArrays and Node.js Buffers.
 * A Buffer might not start from a zero offset on the underlying ArrayBuffer.
 * Using byteOffset, even when `array` is using only a portion of the
 * underlying ArrayBuffer (e.g., for optimization purposes with small arrays),
 * we still get a view on the right values.
 * See https://nodejs.org/api/buffer.html#bufbyteoffset
 * @param {Uint8Array} array - The array to get a DataView on.
 * @returns {DataView} - A DataView on the array.
 */
function getDataView(array: Uint8Array): DataView {
  return new DataView(array.buffer, array.byteOffset, array.byteLength)
}

/**
 * Checks whether a given array has a valid PNG header.
 *
 * @param {Uint8Array} array - The array to check.
 * @returns {boolean} - true if array has a valid PNG header, false otherwise.
 */
function isPNG(array: Uint8Array): boolean {
  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  if (array.length < pngSignature.length) {
    return false
  }
  return getDataView(pngSignature).getBigUint64(0) === getDataView(array).getBigUint64(0)
}

/**
 * Computes the CRC32 of a given array.
 * Source: https://github.com/image-js/fast-png/blob/bdb81f93cc55aa89b312b50e5e2e8a39cdbde657/src/common.ts
 *
 * @param {Uint8Array} data - The array to compute the CRC32 of.
 * @returns {number} - The CRC32 of the array.
 */

const crcTable: number[] = []
function crc(data: Uint8Array): number {
  // Pre-compute CRC table
  if (crcTable.length === 0) {
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1)
        } else {
          c >>>= 1
        }
      }
      crcTable[n] = c
    }
  }
  const initialCrc = 0xffffffff
  const updateCrc = (currentCrc: number, d: Uint8Array, length: number): number => {
    let c = currentCrc
    for (let n = 0; n < length; n++) {
      c = crcTable[(c ^ d[n]) & 0xff] ^ (c >>> 8)
    }
    return c
  }
  return (updateCrc(initialCrc, data, data.byteLength) ^ initialCrc) >>> 0
}

/**
 * Adds in a tEXt chunk of a PNG file a metadata with the given key and value.
 * Warning: this function does not check whether the supplied key already exists.
 *
 * @param {Uint8Array} PNGUint8Array - Array containing bytes of a PNG file.
 * @param {string} key - Key (between 1 and 79 characters) used to identify the metadata.
 * @param {string} value - Value of the metadata to be set.
 * @returns {Uint8Array} - Array containing bytes of a PNG file with metadata.
 */
export function addMetadata(PNGUint8Array: Uint8Array<ArrayBuffer>, key: string, value: string): Uint8Array<ArrayBuffer> {
  if (!isPNG(PNGUint8Array)) {
    throw new TypeError('Invalid PNG')
  }

  if (key.length < 1 || key.length > 79) {
    throw new TypeError('Invalid length for key')
  }

  // Prepare tEXt chunk to insert
  const chunkType = encodeString('tEXt')
  const chunkData = encodeString(`${key}\0${value}`)
  const chunkCRC = packNumberAs4Bytes(crc(concatArrays([chunkType, chunkData])))
  const chunkDataLen = packNumberAs4Bytes(chunkData.byteLength)
  const chunk = concatArrays([chunkDataLen, chunkType, chunkData, chunkCRC])

  // Compute header (IHDR) length
  const headerDataLenOffset = 8
  const headerDataLen = getDataView(PNGUint8Array).getUint32(headerDataLenOffset)
  const headerLen = 8 + 4 + 4 + headerDataLen + 4

  // Assemble new PNG
  const head = PNGUint8Array.subarray(0, headerLen)
  const tail = PNGUint8Array.subarray(headerLen)
  return concatArrays([head, chunk, tail])
}
