import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MODE } from '../state/types.ts'
import {
  MEME_THEME_SOURCE,
  adultMemeThemeById,
  offlineMemeThemeById,
  themeForMode,
} from './index.ts'
import type { MemeTheme } from './index.ts'
import { fetchLiveMemeTheme, loadDailyMemeTheme } from './daily.ts'
import type { MemeThemeFetch, MemeThemeTelemetry } from './daily.ts'

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<MemeThemeFetch>> {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
    json: async () => body,
  }
}

const telemetry: MemeThemeTelemetry = {
  currentMode: MODE.Runner,
  weakestMode: MODE.Runner,
  strongestMode: MODE.Brick,
  damageTaken: 2,
  accuracyPct: 50,
  jumps: 7,
  pickups: 3,
  healthPct: 60,
  currentModeStress: 'medium',
  cleanStageStreak: 1,
  recentDeaths: 0,
  recentShiftCount: 2,
  recentChaosFlags: ['mirrorWorld'],
}

describe('daily meme theme loader', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('accepts a valid live payload and caches it for the day', async () => {
    const live = offlineMemeThemeById('six-seven', '2026-09-03') as MemeTheme
    const fetcher = vi.fn<MemeThemeFetch>().mockResolvedValue(jsonResponse(200, live))
    const theme = await loadDailyMemeTheme('2026-09-03', fetcher, localStorage, null, false, telemetry)
    expect(theme.source).toBe(MEME_THEME_SOURCE.Live)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0]?.[1].method).toBe('POST')
    expect(fetcher.mock.calls[0]?.[1].body).toContain('"currentMode":"runner"')

    const cached = await loadDailyMemeTheme('2026-09-03', fetcher, localStorage)
    expect(cached.id).toBe(theme.id)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('falls back offline for 204, invalid json shape, and thrown fetches', async () => {
    const noContent = await loadDailyMemeTheme('2026-09-04', async () => jsonResponse(204, null), localStorage)
    expect(noContent.themeRotations).toBeTruthy()

    localStorage.clear()
    const bad = await loadDailyMemeTheme('2026-09-04', async () => jsonResponse(200, { nope: true }), localStorage)
    expect(bad.themeRotations).toBeTruthy()

    localStorage.clear()
    const thrown = await loadDailyMemeTheme('2026-09-04', async () => { throw new Error('offline') }, localStorage)
    expect(thrown.themeRotations).toBeTruthy()
  })

  it('forced ids and adult mode skip live fetches', async () => {
    const fetcher = vi.fn<MemeThemeFetch>().mockResolvedValue(jsonResponse(200, null))
    const safe = await loadDailyMemeTheme('2026-09-03', fetcher, localStorage, 'six-seven')
    expect(safe.id).toBe('six-seven')
    expect(safe.themeRotations).toBeUndefined()

    const adult = await loadDailyMemeTheme('2026-09-03', fetcher, localStorage, 'kirk-mode', true)
    expect(adult.id).toBe(adultMemeThemeById('kirk-mode', '2026-09-03')?.id)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fetchLiveMemeTheme returns null for non-json responses', async () => {
    const fetcher: MemeThemeFetch = async () => ({
      ...jsonResponse(200, {}),
      headers: { get: () => 'text/plain' },
    })
    await expect(fetchLiveMemeTheme('2026-09-03', fetcher)).resolves.toBeNull()
  })

  it('invalid adult forced ids fall back to adult rotations', async () => {
    const fetcher = vi.fn<MemeThemeFetch>()
    const theme = await loadDailyMemeTheme('2026-09-03', fetcher, localStorage, 'six-seven', true)
    expect(theme.themeRotations).toBeTruthy()
    expect(themeForMode(theme, MODE.Platformer, 0).source).toBe(MEME_THEME_SOURCE.Offline)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
