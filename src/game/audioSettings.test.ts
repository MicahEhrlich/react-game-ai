import { beforeEach, describe, expect, it, vi } from 'vitest'
import { audioSettings, normaliseAudioSettings } from './audioSettings.ts'

describe('audio settings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalises missing and invalid values to defaults or clamps', () => {
    expect(normaliseAudioSettings(null)).toEqual({ musicVolume: 0.6, sfxVolume: 0.8 })
    expect(normaliseAudioSettings({ musicVolume: -1, sfxVolume: 2 })).toEqual({
      musicVolume: 0,
      sfxVolume: 1,
    })
    expect(normaliseAudioSettings({ musicVolume: Number.NaN, sfxVolume: 'loud' })).toEqual({
      musicVolume: 0.6,
      sfxVolume: 0.8,
    })
  })

  it('persists updates and notifies only on real changes', () => {
    const listener = vi.fn()
    const unsubscribe = audioSettings.subscribe(listener)
    audioSettings.setMusicVolume(0.35)
    audioSettings.setMusicVolume(0.35)
    audioSettings.setSfxVolume(0.25)
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('glitch-audio-settings')).toContain('"musicVolume":0.35')
    expect(localStorage.getItem('glitch-audio-settings')).toContain('"sfxVolume":0.25')
  })
})
