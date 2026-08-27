import type { RunMetrics } from '../director/types.ts'
import type { GameMode } from './types.ts'
import { ALL_MODES } from './types.ts'

/**
 * Per-frame-safe metric accumulator. This is a plain module with NO listeners,
 * which is exactly why scenes may write to it from update() -- nothing
 * re-renders. The director reads a snapshot once per shift.
 *
 * Two scopes are tracked at once:
 *   - `window`  the current stage, reset by rollShift(); this is what the
 *               director judges.
 *   - `run`     cumulative over the whole run, for telemetry and for the
 *               "which mode is this player weakest at" bias.
 */
interface Counters {
  shotsFired: number
  shotsHit: number
  damageTaken: number
  pickups: number
  jumps: number
  reactionTotalMs: number
  reactionSamples: number
}

function emptyCounters(): Counters {
  return {
    shotsFired: 0,
    shotsHit: 0,
    damageTaken: 0,
    pickups: 0,
    jumps: 0,
    reactionTotalMs: 0,
    reactionSamples: 0,
  }
}

/** Built from ALL_MODES rather than listed, so a new mode starts at zero
 *  without an edit here. Same idiom as ratePerMode() below. The cast is only
 *  safe because ALL_MODES is derived from MODE and so covers every key. */
function emptyPerMode(): Record<GameMode, number> {
  const out = {} as Record<GameMode, number>
  for (const m of ALL_MODES) out[m] = 0
  return out
}

let windowC = emptyCounters()
let runC = emptyCounters()
let msPerMode = emptyPerMode()
/** Score earned per mode, used to rank which mode the player is weakest at. */
let scorePerMode = emptyPerMode()

function bump(key: keyof Counters, by = 1): void {
  windowC[key] += by
  runC[key] += by
}

export const metrics = {
  shotFired: () => bump('shotsFired'),
  shotHit: () => bump('shotsHit'),
  damaged: (amount: number) => bump('damageTaken', amount),
  pickedUp: () => bump('pickups'),
  jumped: () => bump('jumps'),

  /** Call with the ms between a threat becoming visible and the player acting. */
  reacted: (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return
    bump('reactionTotalMs', ms)
    bump('reactionSamples')
  },

  /** Called once per frame by ModeScene with the frame delta. */
  tickMode: (mode: GameMode, deltaMs: number) => {
    msPerMode[mode] += deltaMs
  },

  scoredIn: (mode: GameMode, points: number) => {
    scorePerMode[mode] += points
  },

  /** Snapshot of the CURRENT STAGE, for the director. */
  snapshot(mode: GameMode, windowMs: number, healthFraction: number): RunMetrics {
    return {
      mode,
      windowMs,
      shotsFired: windowC.shotsFired,
      shotsHit: windowC.shotsHit,
      damageTaken: windowC.damageTaken,
      pickups: windowC.pickups,
      jumps: windowC.jumps,
      avgReactionMs:
        windowC.reactionSamples > 0
          ? windowC.reactionTotalMs / windowC.reactionSamples
          : 0,
      healthFraction,
      msPerMode: { ...msPerMode },
    }
  },

  /** Archive the stage window and start a fresh one. */
  rollShift(): void {
    windowC = emptyCounters()
  },

  /** Cumulative run totals, for telemetry. */
  runTotals: () => ({ ...runC, msPerMode: { ...msPerMode } }),

  /**
   * Score-per-minute in each mode. Modes the player has never touched return
   * `null` rather than 0, so "unplayed" is distinguishable from "played badly".
   */
  ratePerMode(): Record<GameMode, number | null> {
    const out = {} as Record<GameMode, number | null>
    for (const m of ALL_MODES) {
      const ms = msPerMode[m]
      out[m] = ms > 1000 ? scorePerMode[m] / (ms / 60_000) : null
    }
    return out
  },

  resetRun(): void {
    windowC = emptyCounters()
    runC = emptyCounters()
    msPerMode = emptyPerMode()
    scorePerMode = emptyPerMode()
  },
}
