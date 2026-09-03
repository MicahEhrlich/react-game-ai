import { useSyncExternalStore } from 'react'
import { DEV } from '../dev.ts'

const STORAGE_KEY = 'glitch-ai-mode-enabled'
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function defaultAiMode(): boolean {
  return import.meta.env.DEV
}

export function readAiModeEnabled(): boolean {
  if (DEV.ai !== null) return DEV.ai

  const s = storage()
  if (!s) return defaultAiMode()

  try {
    const raw = s.getItem(STORAGE_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {}

  return defaultAiMode()
}

export function setAiModeEnabled(enabled: boolean): void {
  const s = storage()
  if (s) {
    try {
      s.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {}
  }

  for (const l of [...listeners]) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAiModeEnabled(): boolean {
  return useSyncExternalStore(subscribe, readAiModeEnabled, readAiModeEnabled)
}
