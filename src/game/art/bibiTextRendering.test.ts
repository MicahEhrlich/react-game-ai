/// <reference types="node" />
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { COURT_TEXT } from '../../memeTheme/bibiSprites.ts'
import { COURT_TEXT_STYLE } from './bibiArt.ts'

// Exercise Phaser's renderer, rather than duplicating its RTL position maths.
const require = createRequire(import.meta.url)
// Skip unrelated browser capability probes in the DOM emulator's empty canvas.
vi.stubGlobal('importScripts', vi.fn())
const Text = require(join(dirname(require.resolve('phaser/package.json')), 'src/gameobjects/text/Text.js')) as {
  prototype: { updateText: (this: unknown) => unknown }
}
vi.unstubAllGlobals()

describe('court label rendering', () => {
  it('draws the complete Hebrew label inside the canvas at resolution 3', () => {
    const measuredWidth = 20
    const context = {
      direction: 'ltr', measureText: vi.fn(() => ({ width: measuredWidth })),
      save: vi.fn(), restore: vi.fn(), scale: vi.fn(), translate: vi.fn(),
      clearRect: vi.fn(), strokeText: vi.fn(), fillText: vi.fn(),
    }
    const label = {
      canvas: { width: 1, height: 1 }, context,
      _text: COURT_TEXT, splitRegExp: /\r\n|\r|\n/,
      letterSpacing: 0, lineSpacing: 0, autoRound: false,
      style: { ...COURT_TEXT_STYLE, fixedWidth: 0, fixedHeight: 0,
        metrics: { fontSize: 9, ascent: 8, descent: 1 },
        syncFont: vi.fn(), syncStyle: vi.fn(), syncShadow: vi.fn() },
      padding: { left: 0, right: 0, top: 0, bottom: 0 },
      updateDisplayOrigin: vi.fn(),
      frame: { setSize: vi.fn(), source: { updateSize: vi.fn(), resolution: 1 }, updateUVs: vi.fn() },
    }

    Text.prototype.updateText.call(label)

    expect(context.scale).toHaveBeenCalledWith(3, 3)
    expect(context.fillText).toHaveBeenCalledOnce()
    const [text, x, y] = context.fillText.mock.calls[0] as [string, number, number]
    expect(text).toBe('בג״ץ')
    const glyphLeft = context.direction === 'rtl' ? x - measuredWidth : x
    expect(glyphLeft).toBeGreaterThanOrEqual(0)
    expect(glyphLeft + measuredWidth).toBeLessThanOrEqual(label.canvas.width / 3)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(label.canvas.height / 3)
  })
})
