import { beforeEach, describe, expect, it } from 'vitest'
import { touch } from './touch.ts'

describe('touch joystick helpers', () => {
  beforeEach(() => touch.releaseAll())

  it('keeps tiny drags in the dead zone', () => {
    touch.setDirFromVector(4, -5)
    expect(touch.state.dirX).toBe(0)
    expect(touch.state.dirY).toBe(0)
  })

  it('maps cardinal and diagonal drags to digital axes', () => {
    touch.setDirFromVector(-40, 0)
    expect(touch.state.dirX).toBe(-1)
    expect(touch.state.dirY).toBe(0)

    touch.setDirFromVector(40, -40)
    expect(touch.state.dirX).toBe(1)
    expect(touch.state.dirY).toBe(-1)

    touch.setDirFromVector(0, 40)
    expect(touch.state.dirX).toBe(0)
    expect(touch.state.dirY).toBe(1)
  })

  it('tracks joystick motion direction even before crossing back through center', () => {
    touch.setDirFromVector(40, 0)
    expect(touch.state.dirX).toBe(1)

    touch.setDirFromMotion(-3, 0)
    expect(touch.state.dirX).toBe(-1)
    expect(touch.state.dirY).toBe(0)

    touch.setDirFromMotion(0, 3)
    expect(touch.state.dirX).toBe(0)
    expect(touch.state.dirY).toBe(1)
  })

  it('resets movement on release', () => {
    touch.setDirFromVector(40, -40)
    touch.releaseHeld()
    expect(touch.state.dirX).toBe(0)
    expect(touch.state.dirY).toBe(0)
  })

  it('supports joystick-held shooter fire without direct aim coordinates', () => {
    touch.setDirFromVector(40, 0)
    touch.setAction(true)
    expect(touch.state.action).toBe(true)
    expect(touch.state.directTouch).toBe(false)
    expect(touch.state.aimX).toBeNull()
    expect(touch.state.aimY).toBeNull()
  })

  it('sets one slide edge for runner drag-style ducking', () => {
    touch.setSlide(true)
    touch.setSlide(true)
    expect(touch.state.slide).toBe(true)
    expect(touch.consumeSlideEdge()).toBe(true)
    expect(touch.consumeSlideEdge()).toBe(false)
  })
})
