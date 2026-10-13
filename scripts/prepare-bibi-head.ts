/** Package the transparent head cutout and its monochrome date-mark variant. */
import { readFileSync, writeFileSync } from 'node:fs'
import { readRgbaPng, rgbaPng } from './pngRgba.ts'

const source = readRgbaPng(readFileSync('src/assets/bibi/head-cutout.png'))
let left = source.width, top = source.height, right = -1, bottom = -1
// Ignore negligible alpha noise outside the cutout when finding its sprite frame.
for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
  if (source.pixels[(y * source.width + x) * 4 + 3] <= 16) continue
  left = Math.min(left, x); top = Math.min(top, y)
  right = Math.max(right, x); bottom = Math.max(bottom, y)
}
if (right < left || bottom < top) throw new Error('Head cutout is empty')
left = Math.max(0, left - 1); top = Math.max(0, top - 1)
right = Math.min(source.width - 1, right + 1); bottom = Math.min(source.height - 1, bottom + 1)
const width = right - left + 1, height = bottom - top + 1
const pixels = Buffer.alloc(width * height * 4)
for (let y = 0; y < height; y++) {
  const start = ((y + top) * source.width + left) * 4
  source.pixels.copy(pixels, y * width * 4, start, start + width * 4)
}
writeFileSync('src/assets/bibi/head.png', rgbaPng({ width, height, pixels }))
const monochrome = Buffer.from(pixels)
for (let at = 0; at < monochrome.length; at += 4) {
  const value = pixels[at] * 0.299 + pixels[at + 1] * 0.587 + pixels[at + 2] * 0.114 >= 140 ? 255 : 0
  monochrome[at] = value; monochrome[at + 1] = value; monochrome[at + 2] = value
}
writeFileSync('src/assets/bibi/head-mono.png', rgbaPng({ width, height, pixels: monochrome }))
console.log(`Prepared ${width}×${height} head; cutout colors and alpha preserved within the sprite frame`)
