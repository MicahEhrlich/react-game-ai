import type { ModifierDraft, StageModifiers } from './types.ts'

export const DEFAULT_MODIFIERS: StageModifiers = {
  gravityScale: 1,
  playerSpeedScale: 1,
  spawnRateScale: 1,
  projectileSpeedScale: 1,
  scoreMultiplier: 1,
  invertControls: false,
  mirrorWorld: false,
  fogOfWar: false,
  shiftDurationMs: 75_000,
}

/**
 * Hard playability bounds. Every numeric modifier is clamped to these before
 * it can reach a scene -- this is the guard that stops a bad decision from
 * producing an unplayable stage, and it matters most for a future LLM-backed
 * director whose output cannot be trusted the way the heuristic's can.
 */
const RANGE: Readonly<Record<string, readonly [number, number]>> = {
  gravityScale: [0.5, 1.6],
  playerSpeedScale: [0.7, 1.4],
  spawnRateScale: [0.5, 2.0],
  projectileSpeedScale: [0.6, 1.8],
  scoreMultiplier: [1, 3],
  shiftDurationMs: [60_000, 90_000],
}

function clampNumber(key: keyof typeof RANGE, value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const [lo, hi] = RANGE[key]
  return Math.min(hi, Math.max(lo, value))
}

/**
 * Merges a partial over the defaults and forces the result into range. Also
 * enforces the "at most one chaos flag" rule, in flag-priority order, so no
 * caller can stack inverted controls on top of a mirrored, fogged world.
 */
export function clampModifiers(partial: ModifierDraft): StageModifiers {
  const merged = { ...DEFAULT_MODIFIERS, ...partial }

  // Priority order: the first flag set wins, the rest are dropped.
  const invertControls = merged.invertControls === true
  const mirrorWorld = !invertControls && merged.mirrorWorld === true
  const fogOfWar = !invertControls && !mirrorWorld && merged.fogOfWar === true

  return {
    gravityScale: clampNumber('gravityScale', merged.gravityScale, 1),
    playerSpeedScale: clampNumber('playerSpeedScale', merged.playerSpeedScale, 1),
    spawnRateScale: clampNumber('spawnRateScale', merged.spawnRateScale, 1),
    projectileSpeedScale: clampNumber(
      'projectileSpeedScale',
      merged.projectileSpeedScale,
      1,
    ),
    scoreMultiplier: clampNumber('scoreMultiplier', merged.scoreMultiplier, 1),
    invertControls,
    mirrorWorld,
    fogOfWar,
    shiftDurationMs: clampNumber(
      'shiftDurationMs',
      merged.shiftDurationMs,
      DEFAULT_MODIFIERS.shiftDurationMs,
    ),
  }
}

/** True if any chaos flag is set -- used for the "never twice in a row" rule. */
export function hasChaosFlag(m: StageModifiers): boolean {
  return m.invertControls || m.mirrorWorld || m.fogOfWar
}
