import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'glitch-audio-settings'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface AudioSettings {
  readonly musicVolume: number
  readonly sfxVolume: number
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
}

let settings: AudioSettings = load()
const listeners = new Set<() => void>()

function storage(): StorageLike | null {
  try {
    const maybe = globalThis as typeof globalThis & { window?: { localStorage?: StorageLike } }
    return maybe.window?.localStorage ?? null
  } catch {
    return null
  }
}

function clamp(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(0, Math.min(1, v))
}

function readStorage(): string | null {
  try {
    return storage()?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function writeStorage(v: AudioSettings): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {}
}

export function normaliseAudioSettings(raw: unknown): AudioSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_AUDIO_SETTINGS
  const r = raw as Record<string, unknown>
  return {
    musicVolume: clamp(r.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    sfxVolume: clamp(r.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
  }
}

function load(): AudioSettings {
  try {
    const raw = readStorage()
    return raw ? normaliseAudioSettings(JSON.parse(raw) as unknown) : DEFAULT_AUDIO_SETTINGS
  } catch {
    return DEFAULT_AUDIO_SETTINGS
  }
}

function patch(p: Partial<AudioSettings>): void {
  const next = normaliseAudioSettings({ ...settings, ...p })
  if (
    Object.is(next.musicVolume, settings.musicVolume) &&
    Object.is(next.sfxVolume, settings.sfxVolume)
  ) {
    return
  }
  settings = next
  writeStorage(settings)
  for (const l of [...listeners]) l()
}

export const audioSettings = {
  get: (): AudioSettings => settings,
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  setMusicVolume: (volume: number) => patch({ musicVolume: volume }),
  setSfxVolume: (volume: number) => patch({ sfxVolume: volume }),
}

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(audioSettings.subscribe, audioSettings.get)
}
