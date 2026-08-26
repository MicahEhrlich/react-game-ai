import { useSyncExternalStore } from 'react'
import { DEV } from '../dev.ts'
import type { GameMode, GameSnapshot } from './types.ts'
import { MODE, PHASE } from './types.ts'
import { START_HEALTH } from '../game/constants.ts'

const INITIAL: GameSnapshot = {
  phase: PHASE.Menu,
  score: 0,
  health: START_HEALTH,
  maxHealth: START_HEALTH,
  multiplier: 1,
  // Placeholder for the menu, where no mode is running. startRun() installs
  // the real one, which is random per run.
  mode: DEV.mode ?? MODE.Platformer,
  nextMode: null,
  shiftIndex: 0,
  secondsToShift: 0,
  shiftWarning: false,
  lastRunScore: 0,
  lastDirectorNotes: [],
  activeChaos: null,
}

let snapshot: GameSnapshot = INITIAL
const listeners = new Set<() => void>()

function patch(p: Partial<GameSnapshot>): void {
  const changed = (Object.keys(p) as (keyof GameSnapshot)[]).some(
    (k) => !Object.is(snapshot[k], p[k]),
  )
  if (!changed) return
  snapshot = { ...snapshot, ...p }
  for (const l of [...listeners]) l()
}

export const gameStore = {
  get: (): GameSnapshot => snapshot,
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  patch,

  /** Points are pre-multiplied by the caller (ModeScene.award). */
  addScore: (n: number) => patch({ score: snapshot.score + n }),

  /**
   * Returns the health remaining. Damage always breaks the multiplier -- that
   * coupling is what makes the multiplier a real risk/reward dial rather than
   * a passive timer.
   */
  damage: (n: number): number => {
    const health = Math.max(0, snapshot.health - n)
    patch(
      health > 0
        ? { health, multiplier: 1 }
        : { health: 0, multiplier: 1, phase: PHASE.GameOver, lastRunScore: snapshot.score },
    )
    return health
  },

  heal: (n: number) => patch({ health: Math.min(snapshot.maxHealth, snapshot.health + n) }),

  bumpMultiplier: (by = 1, max = 8) =>
    patch({ multiplier: Math.min(max, snapshot.multiplier + by) }),

  /** `mode` comes from the orchestrator, which picks it once per run. */
  startRun: (mode: GameMode) => patch({ ...INITIAL, phase: PHASE.Playing, mode }),

  toMenu: () => patch({ ...INITIAL, phase: PHASE.Menu }),
}

export function useGameState(): GameSnapshot {
  return useSyncExternalStore(gameStore.subscribe, gameStore.get)
}

/** For leaf components that only need one scalar -- avoids whole-tree re-renders. */
export function useGameValue<T extends string | number | boolean | null>(
  select: (s: GameSnapshot) => T,
): T {
  return useSyncExternalStore(gameStore.subscribe, () => select(snapshot))
}
