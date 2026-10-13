import { createBibiHead, bibiHeadPose, BIBI_AIRCRAFT_HEAD_TOP, BIBI_HEAD_KEY } from './bibiHead.ts'
import EventEmitter from 'eventemitter3'
import type Phaser from 'phaser'
import { describe, expect, it, vi } from 'vitest'
import { attachThemeLabel, AIRCRAFT_BODY_BOUNDS, COURT_TEXT_STYLE, themeText, drawBibiCharacter, drawBibiDateMark, attachBibiObstacleLabel } from './bibiArt.ts'
import { AIRCRAFT_TITLE, AIRCRAFT_WIDTH, AIRCRAFT_HEIGHT, AIRCRAFT_ORIGIN_Y } from '../../memeTheme/bibiSprites.ts'
import { VIEW_H, VIEW_W } from '../constants.ts'

describe('attached theme labels', () => {
  it('puts court text above cubes and preserves the original 06:29 caption above clocks', () => {
    const owner = Object.assign(new EventEmitter(), { x: 40, y: 80, active: true, visible: true })
    const label = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() }
    const text = vi.fn((_x: number, _y: number, _text: string, _style: unknown) => label)
    const events = new EventEmitter()
    const scene = { events, add: { text } } as unknown as Phaser.Scene
    attachBibiObstacleLabel(scene, owner as unknown as Phaser.GameObjects.Sprite, 'court')
    attachBibiObstacleLabel(scene, owner as unknown as Phaser.GameObjects.Sprite, 'alarm')
    expect(text.mock.calls[0].slice(0, 3)).toEqual([40, 66, 'בג״ץ'])
    expect(text.mock.calls[1].slice(0, 3)).toEqual([40, 68, '06:29'])
    expect(text.mock.calls[1][3]).toMatchObject({ fontSize: '7px', rtl: false,
      color: '#f2eeff', strokeThickness: 2 })
    expect(text.mock.calls[1][3]).not.toHaveProperty('backgroundColor')
    events.emit('shutdown')
    expect(events.listenerCount('postupdate')).toBe(0)
  })
  it('follows moving owners, keeps Hebrew unflipped, and cleans up on destruction', () => {
    const owner = Object.assign(new EventEmitter(), { x: 12, y: 24, active: true, visible: true, flipX: true })
    const events = new EventEmitter()
    const label = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), destroy: vi.fn() }
    const text = vi.fn((_x: number, _y: number, _text: string, _style: unknown) => label)
    const scene = { events, add: { text } } as unknown as Phaser.Scene
    attachThemeLabel(scene, owner as unknown as Phaser.GameObjects.Sprite, 'בג״ץ')
    expect(text.mock.calls[0][3]).toMatchObject({ rtl: false, fontFamily: 'Arial, sans-serif',
      fontSize: '9px', fontStyle: 'bold', resolution: 3, strokeThickness: 1 })
    owner.x = 70; owner.y = 80
    events.emit('postupdate')
    expect(label.setPosition).toHaveBeenLastCalledWith(70, 68)
    owner.visible = false
    events.emit('postupdate')
    expect(label.setVisible).toHaveBeenLastCalledWith(false)
    owner.emit('destroy')
    expect(label.destroy).toHaveBeenCalledOnce()
    expect(events.listenerCount('postupdate')).toBe(0)
    expect(events.listenerCount('shutdown')).toBe(0)
  })
  it('cleans up all following callbacks on scene shutdown', () => {
    const owner = Object.assign(new EventEmitter(), { x: 0, y: 0, active: true, visible: true })
    const label = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() }
    const events = new EventEmitter()
    attachThemeLabel({ events, add: { text: () => label } } as unknown as Phaser.Scene,
      owner as unknown as Phaser.GameObjects.Sprite, '$ Qatar')
    events.emit('shutdown')
    expect(label.destroy).toHaveBeenCalledOnce()
    expect(events.listenerCount('postupdate')).toBe(0)
    expect(owner.listenerCount('destroy')).toBe(0)
  })
  it('fits the complete artwork within the viewport at every permitted body edge', () => {
    const bounds = AIRCRAFT_BODY_BOUNDS
    // The ship still has a 12×8 body, centred on the hidden 16px sprite.
    for (const x of [bounds.x + 6, bounds.x + bounds.width - 6]) {
      expect(x - AIRCRAFT_WIDTH / 2).toBeGreaterThanOrEqual(0)
      expect(x + AIRCRAFT_WIDTH / 2).toBeLessThanOrEqual(VIEW_W)
    }
    for (const y of [bounds.y + 4, bounds.y + bounds.height - 4]) {
      expect(y - BIBI_AIRCRAFT_HEAD_TOP).toBeGreaterThanOrEqual(0)
      expect(y + AIRCRAFT_HEIGHT - AIRCRAFT_ORIGIN_Y).toBeLessThanOrEqual(VIEW_H)
    }
  })
  it('renders the exact aircraft title right-to-left without court-specific font sizing', () => {
    const label = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() }
    const text = vi.fn((_x: number, _y: number, _text: string, _style: unknown) => label)
    themeText({ add: { text } } as unknown as Phaser.Scene, 0, 0, AIRCRAFT_TITLE, 8)
    expect(text.mock.calls[0][2]).toBe('כנף ציון')
    expect(text.mock.calls[0][3]).toMatchObject({ rtl: true, fontSize: '8px' })
    expect(COURT_TEXT_STYLE.color).toBe('#ffffff')
  })
  it('anchors the taller character at the existing feet and keeps sliding art below the gate', () => {
    const fillRect = vi.fn((_x: number, _y: number, _w: number, _h: number) => {})
    const graphics = { clear: vi.fn(), fillStyle: vi.fn(), fillRect } as unknown as Phaser.GameObjects.Graphics
    drawBibiCharacter(graphics, 'player-idle', 0)
    expect(Math.min(...fillRect.mock.calls.map((call) => call[1]))).toBe(-24)
    expect(Math.max(...fillRect.mock.calls.map((call) => call[1] + call[3]))).toBe(8)
    fillRect.mockClear()
    drawBibiCharacter(graphics, 'player-slide', 0)
    expect(Math.min(...fillRect.mock.calls.map((call) => call[1]))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...fillRect.mock.calls.map((call) => call[1] + call[3]))).toBeLessThanOrEqual(8)
  })
  it('renders the date portrait and numerals using only black and white', () => {
    const graphics = { clear: vi.fn(), fillStyle: vi.fn().mockReturnThis(), fillRect: vi.fn().mockReturnThis() }
    drawBibiDateMark(graphics as unknown as Phaser.GameObjects.Graphics)
    expect(new Set(graphics.fillStyle.mock.calls.map((call) => call[0]))).toEqual(new Set([0x000000, 0xffffff]))
  })
  it('keeps the reference head attached when facing, upside down, or sliding', () => {
    expect(bibiHeadPose('platformer', 'player-idle', false, false)).toMatchObject({ dx: 0, dy: -5, width: 20, height: 25, originY: 1 })
    expect(bibiHeadPose('platformer', 'player-idle', true, true)).toMatchObject({ dx: 0, dy: 5, originY: 0 })
    expect(bibiHeadPose('shooter', 'ship-0', false, false)).toMatchObject({ dx: 8, dy: -17 })
    expect(bibiHeadPose('shooter', 'ship-0', true, false)).toMatchObject({ dx: -8, dy: -17 })
    const slide = bibiHeadPose('runner', 'player-slide', false, false)
    expect(slide).toMatchObject({ width: 10, height: 6 })
    expect(slide.originY).toBe(0)
    expect(slide.dy + slide.height).toBeLessThanOrEqual(8)
    expect(bibiHeadPose('runner', 'player-slide', true, false).dx).toBe(-slide.dx)
  })
  it('creates the head as visual art without registering another collision body', () => {
    const head = { setDepth: vi.fn().mockReturnThis() }
    const image = vi.fn(() => head)
    const physicsImage = vi.fn()
    const scene = { textures: { exists: () => true }, add: { image }, physics: { add: { image: physicsImage } } }
    expect(createBibiHead(scene as unknown as Phaser.Scene)).toBe(head)
    expect(image).toHaveBeenCalledWith(0, 0, BIBI_HEAD_KEY)
    expect(physicsImage).not.toHaveBeenCalled()
  })
  it('draws only the suit and legs when the reference head image is available', () => {
    const fillRect = vi.fn((_x: number, _y: number, _w: number, _h: number) => {})
    const graphics = { clear: vi.fn(), fillStyle: vi.fn(), fillRect } as unknown as Phaser.GameObjects.Graphics
    drawBibiCharacter(graphics, 'player-idle', 0, false)
    expect(Math.min(...fillRect.mock.calls.map((call) => call[1]))).toBe(-5)
    expect(Math.max(...fillRect.mock.calls.map((call) => call[1] + call[3]))).toBe(8)
  })
})
