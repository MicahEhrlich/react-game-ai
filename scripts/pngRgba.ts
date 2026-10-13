import { deflateSync, inflateSync } from 'node:zlib'

export interface RgbaImage { width: number; height: number; pixels: Buffer }
export function readRgbaPng(png: Buffer): RgbaImage {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error('Expected an 8-bit, non-interlaced RGBA PNG')
  const chunks: Buffer[] = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x
      const a = x >= 4 ? pixels[index - 4] : 0, b = y > 0 ? pixels[index - stride] : 0
      const c = y > 0 && x >= 4 ? pixels[index - stride - 4] : 0
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const prediction = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2)
        : filter === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : NaN
      if (!Number.isFinite(prediction)) throw new Error('Invalid PNG filter')
      pixels[index] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255
    }
  }
  return { width, height, pixels }
}
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of body) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  const result = Buffer.alloc(body.length + 8)
  result.writeUInt32BE(data.length, 0); body.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4)
  return result
}
export function rgbaPng(image: RgbaImage): Buffer {
  const { width, height, pixels } = image, stride = width * 4
  const rows = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}
