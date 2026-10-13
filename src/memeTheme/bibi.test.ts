import { describe, expect, it, vi } from 'vitest'
import { ALL_MODES } from '../state/types.ts'
import { PALETTE } from '../game/art/palette.ts'
import { BRICK, BRICK_CRACKED, BALL, SHOT_PLAYER } from '../game/art/sprites.ts'
import { BIBI_CHARACTER, BIBI_CHARACTER_PALETTE, BIBI_MONO_HEAD, BIBI_DATE_MARK,
  BIBI_SPRITES, COURT_CUBE, PROTESTER_SPRITES, BIBI_AIRCRAFT, AIRCRAFT_STAR, AIRCRAFT_STAR_X, AIRCRAFT_STAR_Y } from './bibiSprites.ts'
import { adultMemeThemeById, offlineMemeThemeById, themeBundleForDate, themeForMode, normaliseMemeTheme } from './index.ts'
import { loadDailyMemeTheme } from './daily.ts'

describe('Bibi adult theme', () => {
  it('is valid, adult-only, and exposes the same backing soundtrack in every mode', async () => {
    const theme = adultMemeThemeById('bibi-mode', '2026-10-13')!
    expect(theme.label).toBe('BIBI MODE')
    expect(normaliseMemeTheme(theme, theme.date, 'offline')).not.toBeNull()
    expect(offlineMemeThemeById(theme.id, theme.date)).toBeNull()
    expect(theme.musicPlans).toBeUndefined()
    for (const mode of ALL_MODES) {
      expect(themeForMode(theme, mode).musicPlan.style).toBe('bibi mp3 loop')
    }
    const fetcher = vi.fn()
    const forced = await loadDailyMemeTheme(theme.date, fetcher, null, theme.id, true)
    expect(forced.id).toBe(theme.id)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('appears in adult rotations over the catalog cycle', () => {
    const seen = new Set<string>()
    for (let day = 10; day < 20; day++) {
      const bundle = themeBundleForDate(`2026-10-${day}`, true)
      for (const mode of ALL_MODES) for (const t of bundle.themeRotations![mode]) seen.add(t.id)
    }
    expect(seen.has('bibi-mode')).toBe(true)
  })
  it('provides complete 16px sprites using valid palette characters', () => {
    for (const sprite of [...Object.values(BIBI_SPRITES), ...PROTESTER_SPRITES]) {
      expect(sprite).toHaveLength(16)
      for (const row of sprite) {
        expect(row).toHaveLength(16)
        for (const pixel of row) expect(pixel === '.' || PALETTE[pixel] !== undefined).toBe(true)
      }
    }
  })
  it('uses regular brick states and ball only in brick mode, preserving other cubes', () => {
    const theme = adultMemeThemeById('bibi-mode')!
    const brick = themeForMode(theme, 'brick')
    expect(brick.spritePack?.brick).toEqual(BRICK)
    expect(brick.spritePack?.brickCracked).toEqual(BRICK_CRACKED)
    expect(brick.spritePack?.ball).toEqual(BALL)
    expect(themeForMode(theme, 'runner').spritePack?.brick).toEqual(COURT_CUBE)
    expect(themeForMode(theme, 'shooter').spritePack?.brick).toEqual(COURT_CUBE)
    expect(themeForMode(theme, 'platformer').spritePack?.brick).toEqual(COURT_CUBE)
    expect(normaliseMemeTheme(theme, theme.date, 'offline')).not.toBeNull()
  })
  it('has four distinct protesters with raised symbol placards and regular shooter projectiles', () => {
    expect(PROTESTER_SPRITES).toHaveLength(4)
    expect(new Set(PROTESTER_SPRITES.map((sprite) => sprite.join(''))).size).toBe(4)
    for (const sprite of PROTESTER_SPRITES) {
      expect(sprite[0].slice(0, 8)).toBe('kkkkkkkk')
      expect(sprite[3].slice(10, 14)).not.toBe('....')
      expect(sprite[15].slice(9)).toContain('k')
    }
    const shooter = themeForMode(adultMemeThemeById('bibi-mode')!, 'shooter')
    expect(shooter.spritePack?.shooterProjectile).toEqual(SHOT_PLAYER)
    expect(shooter.modeFlavor.shooter.projectile).toBe('SHOT')
  })
  it('keeps the full aircraft composition compact and its seven-pixel emblem unobscured', () => {
    expect(BIBI_AIRCRAFT).toHaveLength(48)
    for (const row of BIBI_AIRCRAFT) {
      expect(row).toHaveLength(48)
      for (const pixel of row) expect(pixel === '.' || BIBI_CHARACTER_PALETTE[pixel] !== undefined).toBe(true)
    }
    AIRCRAFT_STAR.forEach((row, y) => {
      expect(BIBI_AIRCRAFT[y + AIRCRAFT_STAR_Y].slice(AIRCRAFT_STAR_X, AIRCRAFT_STAR_X + 7)).toBe(row.replaceAll('.', 'w'))
      expect([...row].reverse().join('')).toBe(row)
    })
  })
  it('provides a larger shaded portrait and a black-and-white head in the date mark', () => {
    expect(BIBI_CHARACTER).toHaveLength(32)
    for (const row of BIBI_CHARACTER) {
      expect(row).toHaveLength(24)
      for (const pixel of row) expect(pixel === '.' || BIBI_CHARACTER_PALETTE[pixel] !== undefined).toBe(true)
    }
    expect(new Set(BIBI_CHARACTER.join('')).size).toBeGreaterThan(10)
    for (const sprite of [BIBI_MONO_HEAD, BIBI_DATE_MARK]) {
      for (const pixel of sprite.join('')) expect(['.', 'w', 'k']).toContain(pixel)
    }
    expect(BIBI_DATE_MARK).toHaveLength(20)
    expect(BIBI_DATE_MARK.every((row) => row.length === 48)).toBe(true)
    expect(BIBI_DATE_MARK.some((row) => row.slice(32).includes('k'))).toBe(true)
    expect(adultMemeThemeById('bibi-mode')!.shiftLines).toContain('7.10')
    expect(adultMemeThemeById('bibi-mode')!.shiftLines).not.toContain('710')
  })
})
