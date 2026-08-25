import type Phaser from 'phaser'
import { DEPTH, VIEW_H, VIEW_W } from '../constants.ts'

/**
 * The in-canvas half of the glitch transition. Pure display-list work --
 * random slice bars and channel-split smears drawn with Graphics -- because
 * a post-processing pipeline would tie the most load-bearing visual in the
 * game to a renderer API we would rather not depend on. The React
 * GlitchOverlay draws the other half, on top of the canvas.
 */
const SLICE_COLORS = [0xff3ea5, 0x3ef0ff, 0xf2eeff, 0x08060f]

export interface Corruption {
  stop(): void
}

export function runCorruption(scene: Phaser.Scene, durationMs: number): Corruption {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.Corruption)

  const redraw = () => {
    g.clear()
    // Horizontal tear bars: a few wide slices per frame, alpha-weighted so
    // the effect builds rather than strobing at full intensity.
    const bars = 3 + Math.floor(Math.random() * 5)
    for (let i = 0; i < bars; i++) {
      const y = Math.random() * VIEW_H
      const h = 1 + Math.random() * 9
      const color = SLICE_COLORS[Math.floor(Math.random() * SLICE_COLORS.length)]
      g.fillStyle(color, 0.25 + Math.random() * 0.55)
      g.fillRect(-VIEW_W * 0.1 + Math.random() * VIEW_W * 0.2, y, VIEW_W * 1.2, h)
    }
    // Two thin scan lines that read as the CRT losing sync.
    g.fillStyle(0x3ef0ff, 0.5)
    g.fillRect(0, Math.random() * VIEW_H, VIEW_W, 1)
    g.fillStyle(0xff3ea5, 0.5)
    g.fillRect(0, Math.random() * VIEW_H, VIEW_W, 1)
  }

  redraw()
  const ticker = scene.time.addEvent({ delay: 45, loop: true, callback: redraw })

  const stop = () => {
    ticker.remove()
    g.destroy()
  }

  scene.time.delayedCall(durationMs, stop)

  return { stop }
}
