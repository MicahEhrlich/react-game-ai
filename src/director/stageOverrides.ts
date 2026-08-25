import type { GameMode } from '../state/types.ts'
import type { ModifierDraft } from './types.ts'

/**
 * Task 4's seam for server-driven difficulty: the shape a backend would
 * return so it can override the local director per stage.
 *
 * The fetch happens ONCE per run, at START_RUN, and the per-shift lookup is
 * synchronous against the cached payload. That ordering is deliberate -- a
 * shift must never wait on the network, and a failed or slow fetch degrades
 * to "the local director decides", which is the correct behaviour rather
 * than a fallback.
 */
export interface StageOverridePayload {
  /** Applied to every stage, before the more specific entries below. */
  readonly all?: ModifierDraft
  /** Keyed by GameMode. */
  readonly byMode?: Partial<Record<GameMode, ModifierDraft>>
  /** Keyed by shift index, as a string. Highest precedence. */
  readonly byShift?: Readonly<Record<string, ModifierDraft>>
}

const SOURCE = '/mock/overrides.json'

let cache: StageOverridePayload | null = null

/** Call at the start of a run. Never throws; never blocks gameplay. */
export async function primeOverrides(): Promise<void> {
  cache = null
  try {
    const res = await fetch(SOURCE, { cache: 'no-store' })
    if (!res.ok) return
    const parsed: unknown = await res.json()
    if (parsed && typeof parsed === 'object') cache = parsed as StageOverridePayload
  } catch {
    // No payload served -- the local director is fully in charge.
  }
}

/**
 * Synchronous lookup against the primed payload. Returns null when nothing
 * applies, so the caller can skip the merge entirely.
 */
export function getOverride(
  mode: GameMode,
  shiftIndex: number,
): ModifierDraft | null {
  if (!cache) return null
  const merged: ModifierDraft = {
    ...cache.all,
    ...cache.byMode?.[mode],
    ...cache.byShift?.[String(shiftIndex)],
  }
  return Object.keys(merged).length > 0 ? merged : null
}
