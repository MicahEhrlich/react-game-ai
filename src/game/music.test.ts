import { afterEach, describe, expect, it, vi } from 'vitest'
const { play, stop, pause, resume } = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn() }))
vi.mock('./loopingTrackPlayer.ts', () => ({ LoopingTrackPlayer: class { play = play; stop = stop; pause = pause; resume = resume } }))
import { music } from './music.ts'
import { adultMemeThemeById, themeForMode } from '../memeTheme/index.ts'

const theme = adultMemeThemeById('bibi-mode', '2026-10-13')!

describe('adult theme soundtrack routing', () => {
  afterEach(() => { music.stop(); vi.clearAllMocks() })
  it('keeps the backing playing across consecutive game modes', () => {
    music.playForTheme(themeForMode(theme, 'platformer'), true)
    music.playForTheme(themeForMode(theme, 'runner'), true)
    music.playForTheme(themeForMode(theme, 'brick'), true)
    expect(play).toHaveBeenCalledTimes(1)
    music.pause(); music.resume()
    expect(pause).toHaveBeenCalledOnce()
    expect(resume).toHaveBeenCalledOnce()
  })
  it('restarts after changing themes or beginning a new run', () => {
    music.playForTheme(theme, true)
    music.playForTheme(adultMemeThemeById('kirk-mode')!, true)
    music.playForTheme(theme, true)
    expect(play).toHaveBeenCalledTimes(2)
    music.stop()
    music.playForTheme(theme, true)
    expect(play).toHaveBeenCalledTimes(3)
  })
  it('requires adult mode for the custom backing player', () => {
    music.playForTheme(theme, false)
    expect(play).not.toHaveBeenCalled()
  })
})
