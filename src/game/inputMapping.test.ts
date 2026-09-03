import { describe, expect, it } from 'vitest'
import { MODE } from '../state/types.ts'
import { mapInputForMode } from './inputMapping.ts'
import type { RawInputState } from './inputMapping.ts'

const rawBase: RawInputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpJustPressed: false,
  slideHeld: false,
  slideJustPressed: false,
  actionHeld: false,
  actionJustPressed: false,
  aimX: null,
  aimY: null,
  directTouch: false,
}

describe('mode input mapping', () => {
  it('swaps runner jump and slide actions when controls are inverted', () => {
    const mapped = mapInputForMode(
      { ...rawBase, down: true, slideHeld: true, slideJustPressed: true },
      MODE.Runner,
      { invertControls: true },
    )
    expect(mapped.dirY).toBe(1)
    expect(mapped.jumpHeld).toBe(true)
    expect(mapped.jumpJustPressed).toBe(true)
    expect(mapped.slideHeld).toBe(false)
  })

  it('keeps runner arrows uninverted while platformer arrows invert', () => {
    expect(mapInputForMode({ ...rawBase, right: true }, MODE.Runner, { invertControls: true }).dirX).toBe(1)
    expect(mapInputForMode({ ...rawBase, right: true }, MODE.Platformer, { invertControls: true }).dirX).toBe(-1)
  })

  it('auto-fires shooter during direct touch without changing neutral desktop input', () => {
    expect(mapInputForMode({ ...rawBase, directTouch: true, aimX: 10, aimY: 20 }, MODE.Shooter, { invertControls: false }).actionHeld).toBe(true)
    expect(mapInputForMode(rawBase, MODE.Shooter, { invertControls: false }).actionHeld).toBe(false)
  })
})
