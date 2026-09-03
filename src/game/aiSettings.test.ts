import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadSettings(search = '') {
  vi.resetModules()
  window.history.pushState({}, '', `/${search}`)
  return import('./aiSettings.ts')
}

describe('AI Mode settings', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('defaults on in local dev when no preference exists', async () => {
    const { readAiModeEnabled } = await loadSettings()
    expect(readAiModeEnabled()).toBe(true)
  })

  it('persists the player preference', async () => {
    const { readAiModeEnabled, setAiModeEnabled } = await loadSettings()
    setAiModeEnabled(false)
    expect(readAiModeEnabled()).toBe(false)
    expect(localStorage.getItem('glitch-ai-mode-enabled')).toBe('0')

    setAiModeEnabled(true)
    expect(readAiModeEnabled()).toBe(true)
    expect(localStorage.getItem('glitch-ai-mode-enabled')).toBe('1')
  })

  it('lets query params override storage', async () => {
    localStorage.setItem('glitch-ai-mode-enabled', '0')
    const forcedOn = await loadSettings('?ai=1')
    expect(forcedOn.readAiModeEnabled()).toBe(true)

    localStorage.setItem('glitch-ai-mode-enabled', '1')
    const forcedOff = await loadSettings('?ai=0')
    expect(forcedOff.readAiModeEnabled()).toBe(false)
  })
})
