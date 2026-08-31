import {
  MEME_THEME_SOURCE,
  adultMemeThemeById,
  localDateKey,
  normaliseMemeTheme,
  offlineMemeThemeById,
  themeBundleForDate,
} from './index.ts'
import type { MemeTheme } from './index.ts'
import type { GameMode } from '../state/types.ts'
import { apiUrl } from '../api.ts'

const ENDPOINT = apiUrl('/api/meme-theme')
const STORAGE_KEY = 'glitch-daily-meme-theme'
const ATTEMPT_KEY = 'glitch-daily-meme-theme-attempt'
const TIMEOUT_MS = 6000

export interface MemeThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface MemeThemeTelemetry {
  readonly currentMode: GameMode
  readonly weakestMode: GameMode | null
  readonly strongestMode: GameMode | null
  readonly damageTaken: number
  readonly accuracyPct: number | null
  readonly jumps: number
  readonly pickups: number
  readonly healthPct: number
  readonly currentModeStress: 'low' | 'medium' | 'high'
  readonly cleanStageStreak: number
  readonly recentDeaths: number
  readonly recentShiftCount: number
  readonly recentChaosFlags: readonly string[]
}

export type MemeThemeFetch = (
  input: string,
  init: {
    readonly signal: AbortSignal
    readonly cache: 'no-store'
    readonly method?: 'GET' | 'POST'
    readonly headers?: Readonly<Record<string, string>>
    readonly body?: string
  },
) => Promise<{
  readonly status: number
  readonly ok: boolean
  readonly headers: { get(name: string): string | null }
  json(): Promise<unknown>
}>

function storage(): MemeThemeStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readCached(s: MemeThemeStorage | null, date: string): MemeTheme | null {
  if (!s) return null
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    if ((parsed as { date?: unknown }).date !== date) return null
    return normaliseMemeTheme(parsed, date, MEME_THEME_SOURCE.Live)
  } catch {
    return null
  }
}

function writeCached(s: MemeThemeStorage | null, theme: MemeTheme): void {
  if (!s) return
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(theme))
    s.setItem(ATTEMPT_KEY, theme.date)
  } catch {
    // Private browsing and full storage are both normal offline-ish states.
  }
}

function markAttempted(s: MemeThemeStorage | null, date: string): void {
  if (!s) return
  try {
    s.setItem(ATTEMPT_KEY, date)
  } catch {}
}

function attemptedToday(s: MemeThemeStorage | null, date: string): boolean {
  if (!s) return false
  try {
    return s.getItem(ATTEMPT_KEY) === date
  } catch {
    return false
  }
}

export async function fetchLiveMemeTheme(
  date = localDateKey(),
  fetcher: MemeThemeFetch = fetch,
  telemetry?: MemeThemeTelemetry | null,
): Promise<MemeTheme | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetcher(ENDPOINT, telemetry
      ? {
          signal: controller.signal,
          cache: 'no-store',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ date, telemetry }),
        }
      : { signal: controller.signal, cache: 'no-store' })
    if (res.status === 204) return null
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('application/json')) return null
    return normaliseMemeTheme(await res.json(), date, MEME_THEME_SOURCE.Live)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadDailyMemeTheme(
  date = localDateKey(),
  fetcher: MemeThemeFetch = fetch,
  store: MemeThemeStorage | null = storage(),
  forcedOfflineId?: string | null,
  adultMode = false,
  telemetry?: MemeThemeTelemetry | null,
  memeCycle = false,
): Promise<MemeTheme> {
  if (adultMode) {
    if (forcedOfflineId) return adultMemeThemeById(forcedOfflineId, date) ?? themeBundleForDate(date, true)
    return themeBundleForDate(date, true)
  }

  const forced = offlineMemeThemeById(forcedOfflineId, date)
  if (forced) return forced

  const offline = memeCycle || !forcedOfflineId ? themeBundleForDate(date, false) : themeBundleForDate(date, false)
  const cached = readCached(store, date)
  if (cached?.date === date) return cached
  if (attemptedToday(store, date)) return offline

  markAttempted(store, date)
  const live = await fetchLiveMemeTheme(date, fetcher, telemetry)
  if (!live) return offline
  writeCached(store, live)
  return live
}
