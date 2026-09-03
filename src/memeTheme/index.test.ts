import { describe, expect, it } from 'vitest'
import { MODE } from '../state/types.ts'
import {
  ADULT_MEME_THEME_IDS,
  MEME_THEME_SOURCE,
  OFFLINE_MEME_THEME_IDS,
  adultMemeThemeById,
  normaliseMemeTheme,
  offlineMemeThemeById,
  themeBundleForDate,
  themeForMode,
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
})
