import { describe, expect, it } from 'vitest'
import { ALL_MODES, MODE } from '../state/types.ts'
import {
  ADULT_MEME_THEME_IDS,
  MEME_THEME_SOURCE,
  isRoshHashanahDate,
  OFFLINE_MEME_THEME_IDS,
  adultMemeThemeById,
  normaliseMemeTheme,
  offlineMemeThemeById,
  themeBundleForDate,
  themeForMode,
  roshHashanahThemeForDate,
} from './index.ts'

describe('meme theme catalog and normalization', () => {
  it('keeps safe and adult forced ids separate', () => {
    expect(offlineMemeThemeById('six-seven', '2026-09-03')?.id).toBe('six-seven')
    expect(adultMemeThemeById('six-seven', '2026-09-03')).toBeNull()
    expect(adultMemeThemeById('kirk-mode', '2026-09-03')?.id).toBe('kirk-mode')
    expect(offlineMemeThemeById('kirk-mode', '2026-09-03')).toBeNull()
    expect(new Set([...OFFLINE_MEME_THEME_IDS, ...ADULT_MEME_THEME_IDS]).size).toBe(
      OFFLINE_MEME_THEME_IDS.length + ADULT_MEME_THEME_IDS.length,
    )
  })

  it('rotates themes deterministically by mode and shift', () => {
    const bundle = themeBundleForDate('2026-09-03')
    const first = themeForMode(bundle, MODE.Platformer, 0)
    const second = themeForMode(bundle, MODE.Platformer, 1)
    const again = themeForMode(bundle, MODE.Platformer, 1)
    expect(bundle.themeRotations?.[MODE.Platformer].length).toBeGreaterThanOrEqual(3)
    expect(first.id).not.toBe(second.id)
    expect(second.id).toBe(again.id)
  })

  it('rejects unsafe or malformed live payloads', () => {
    const base = offlineMemeThemeById('six-seven', '2026-09-03')
    expect(base).toBeTruthy()
    expect(normaliseMemeTheme({ ...base, label: '<b>bad</b>' }, '2026-09-03', MEME_THEME_SOURCE.Live)).toBeNull()
    expect(normaliseMemeTheme({ ...base, palette: ['red', '#3ef0ff'] }, '2026-09-03', MEME_THEME_SOURCE.Live)).toBeNull()
    expect(normaliseMemeTheme({ ...base, spritePack: undefined }, '2026-09-03', MEME_THEME_SOURCE.Live)).toBeNull()
  })

  it('provides the Rosh Hashanah theme only during the holiday window', () => {
    const theme = roshHashanahThemeForDate('2026-09-11')
    expect(theme?.id).toBe('rosh-hashanah')
    expect(theme?.spritePack?.apple).toHaveLength(16)
    expect(theme?.spritePack?.honey).toHaveLength(16)
    expect(theme?.modeFlavor.platformer.enemy).toBe('SHOFAR')
    expect(theme?.modeFlavor.platformer.hazard).toBe('POMEGRANATE')
    expect(theme?.shiftLines[0]).toBe('SHANA TOVA')
    expect(theme?.taunts).toContain('SHANA TOVA')
    expect([...theme?.shiftLines ?? [], ...theme?.taunts ?? []]).not.toContain('L SHANAH TOVAH')
    expect(theme?.musicPlan.style).toBe('hava nagila chiptune')
    expect(theme?.musicPlan.scale).toBe('phrygianDominant')
    expect(theme?.musicPlans).toBeUndefined()
    for (const mode of ALL_MODES) {
      for (const shift of [0, 1, 7]) {
        expect(themeForMode(theme!, mode, shift).musicPlan.style).toBe('hava nagila chiptune')
      }
    }
    expect(isRoshHashanahDate('2026-09-13')).toBe(true)
    expect(roshHashanahThemeForDate('2026-09-14')).toBeNull()
    expect(isRoshHashanahDate('2026-09-14')).toBe(false)
  })
})
