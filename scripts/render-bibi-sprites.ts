import { readRgbaPng } from './pngRgba.ts'
import type { RgbaImage } from './pngRgba.ts'
/** Render authored sprite data at 4×/3× for review, including mirrored aircraft. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { BALL, BRICK, BRICK_CRACKED } from '../src/game/art/sprites.ts'
import { BIBI_AIRCRAFT, BIBI_CHARACTER, BIBI_CHARACTER_PALETTE, BIBI_DATE_MARK, PROTESTER_SPRITES, COURT_CUBE, RED_CLOCK, QATAR_DOLLAR } from '../src/memeTheme/bibiSprites.ts'
import type { PixelSprite } from '../src/memeTheme/index.ts'

const width = 800
const height = 400
const pixels = Buffer.alloc(width * height * 3)
for (let i = 0; i < width * height; i++) { pixels[i * 3] = 20; pixels[i * 3 + 1] = 24; pixels[i * 3 + 2] = 38 }
function draw(sprite: PixelSprite, ox: number, oy: number, scale: number, flip = false, palette = BIBI_CHARACTER_PALETTE, hideHead = false): void {
  sprite.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (hideHead && (sprite === BIBI_CHARACTER ? y < 19 : y < 23 && x >= 20 && x < 44)) return
    const color = palette[pixel]
    if (!color) return
    const rgb = Buffer.from(color.slice(1), 'hex')
    const col = flip ? row.length - x - 1 : x
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      rgb.copy(pixels, ((oy + y * scale + sy) * width + ox + col * scale + sx) * 3)
    }
  }))
}
function drawHead(image: RgbaImage, x: number, y: number, w: number, h: number, flip = false): void {
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const sx = Math.floor(col * image.width / w), sy = Math.floor(row * image.height / h)
    const source = (sy * image.width + (flip ? image.width - sx - 1 : sx)) * 4
    const target = ((y + row) * width + x + col) * 3, alpha = image.pixels[source + 3] / 255
    for (let channel = 0; channel < 3; channel++) pixels[target + channel] = Math.round(
      image.pixels[source + channel] * alpha + pixels[target + channel] * (1 - alpha))
  }
}
const head = readRgbaPng(readFileSync('src/assets/bibi/head.png'))
const mono = readRgbaPng(readFileSync('src/assets/bibi/head-mono.png'))
const monochromePalette = { k: '#000000', w: '#ffffff' }
draw(BIBI_AIRCRAFT, 12, 36, 3, false, BIBI_CHARACTER_PALETTE, true)
drawHead(head, 78, 30, 60, 75)
draw(BIBI_AIRCRAFT, 176, 36, 3, true, BIBI_CHARACTER_PALETTE, true)
drawHead(head, 194, 30, 60, 75, true)
draw(BIBI_CHARACTER, 348, 68, 4, false, BIBI_CHARACTER_PALETTE, true)
drawHead(head, 356, 44, 80, 100)
drawHead(mono, 460, 18, 96, 120)
// Draw only the date prefix, using the actual monochrome reference for the zero.
const prefix = BIBI_DATE_MARK.map((row) => row.slice(0, 32))
draw(prefix, 572, 18, 4, false, monochromePalette)
drawHead(mono, 700, 18, 64, 80)
// Native-size game previews beneath the enlarged review art.
draw(BIBI_AIRCRAFT, 348, 236, 1, false, BIBI_CHARACTER_PALETTE, true)
drawHead(head, 370, 234, 20, 25)
draw(BIBI_CHARACTER, 416, 238, 1, false, BIBI_CHARACTER_PALETTE, true)
drawHead(head, 418, 232, 20, 25)
draw(prefix, 464, 238, 1, false, monochromePalette)
drawHead(mono, 496, 238, 16, 20)
const icons = [...PROTESTER_SPRITES, BRICK, BRICK_CRACKED, BALL, COURT_CUBE, RED_CLOCK, QATAR_DOLLAR]
icons.forEach((sprite, i) => draw(sprite, 12 + i * 62, 320, 3))
const raw = Buffer.alloc((width * 3 + 1) * height)
for (let y = 0; y < height; y++) pixels.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data])
  const result = Buffer.alloc(body.length + 8)
  result.writeUInt32BE(data.length, 0); body.copy(result, 4)
  result.writeUInt32BE(crc32(body), result.length - 4)
  return result
}
const header = Buffer.alloc(13)
header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
mkdirSync('artifacts', { recursive: true })
writeFileSync('artifacts/bibi-sprites.png', Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]))
console.log('Rendered artifacts/bibi-sprites.png')
