import { DEV } from '../dev.ts'
import { clampModifiers, hasChaosFlag } from '../director/modifiers.ts'
import { getPacing } from '../director/pacing.ts'
import type { StageModifiers, StagePlan } from '../director/types.ts'
import type { GameMode } from './types.ts'
import { ALL_MODES } from './types.ts'

/**
 * Gameplay state that must survive scene.stop() but has no business in
 * gameStore, because React never renders it. Score, health, multiplier and
 * mode are all discrete and live in gameStore instead -- keeping them out of
 * here is what stops the two channels from ever disagreeing.
 */
interface RunState {
  /** Modifiers the ACTIVE stage was built with. Scenes read this in create(). */
  modifiers: StageModifiers
  /** Precomputed during the shift warning window, consumed at the swap. */
  pendingPlan: StagePlan | null
  modeHistory: GameMode[]
  chaosLastStage: boolean
  runStartMs: number
  stageStartMs: number
}

/**
 * Every run opens on a random mode. The premise is a machine that cannot hold
 * one game — always starting in the platformer undercut that, and it meant
 * two thirds of the content was something you only ever saw second.
 *
 * `?mode=` still pins it, which is what makes the dev override useful.
 */
export function pickStartMode(): GameMode {
  return DEV.mode ?? ALL_MODES[Math.floor(Math.random() * ALL_MODES.length)]
}

function initialModifiers(): StageModifiers {
  // ?mods=... is applied on top of the defaults for the very first stage too,
  // so a forced flag is visible immediately rather than only after one shift.
  return clampModifiers({ shiftDurationMs: getPacing().firstStageMs, ...DEV.mods })
}

const state: RunState = {
  modifiers: initialModifiers(),
  pendingPlan: null,
  // Placeholder only; resetRun() installs the mode the run actually starts on.
  modeHistory: [],
  chaosLastStage: false,
  runStartMs: 0,
  stageStartMs: 0,
}

export const runState = {
  get modifiers(): StageModifiers {
    return state.modifiers
  },
  get pendingPlan(): StagePlan | null {
    return state.pendingPlan
  },
  get modeHistory(): readonly GameMode[] {
    return state.modeHistory
  },
  get chaosLastStage(): boolean {
    return state.chaosLastStage
  },
  get runStartMs(): number {
    return state.runStartMs
  },
  get stageStartMs(): number {
    return state.stageStartMs
  },

  setPendingPlan(plan: StagePlan | null): void {
    state.pendingPlan = plan
  },

  /**
   * Commit the planned stage as the active one. Called at the moment of the
   * scene swap, never earlier -- the running scene must keep the modifiers it
   * was built with until it is actually torn down.
   */
  commitPlan(plan: StagePlan, nowMs: number): void {
    state.modifiers = plan.modifiers
    state.chaosLastStage = hasChaosFlag(plan.modifiers)
    state.modeHistory.push(plan.mode)
    state.pendingPlan = null
    state.stageStartMs = nowMs
  },

  /**
   * Effective stage length. The ?shift= dev override deliberately bypasses the
   * 30-90s clamp so transitions can be exercised in seconds.
   */
  stageDurationMs(): number {
    return DEV.shiftMs ?? state.modifiers.shiftDurationMs
  },

  /**
   * `startMode` is passed in rather than picked here: the orchestrator chooses
   * it once and gives the same value to both channels, so runState's history
   * and gameStore's `mode` can never disagree about how the run began.
   */
  resetRun(nowMs: number, startMode: GameMode): void {
    state.modifiers = initialModifiers()
    state.pendingPlan = null
    state.modeHistory = [startMode]
    state.chaosLastStage = false
    state.runStartMs = nowMs
    state.stageStartMs = nowMs
  },
}
