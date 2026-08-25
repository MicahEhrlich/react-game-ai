import { PALETTE } from './palette.ts'

/** One row per string; one char per pixel; '.' is transparent. */
export type PixelSprite = readonly string[]

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Draws a PixelSprite into `ctx` with its top-left corner at (ox, oy). */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  ox: number,
  oy: number,
): void {
  for (let y = 0; y < sprite.length; y++) {
    const row = sprite[y]
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]]
      if (!color) continue // '.' (or any unmapped char) -> transparent
      ctx.fillStyle = color
      ctx.fillRect(ox + x, oy + y, 1, 1)
    }
  }
}
