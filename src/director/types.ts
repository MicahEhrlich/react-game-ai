import type { GameMode } from '../state/types.ts'

/**
 * Mode-agnostic difficulty vocabulary. The director emits these without
 * knowing which mode comes next; each scene's setupMode() maps them onto its
 * own numbers (see modifiers.ts for the ranges clampModifiers enforces).
 */
export interface StageModifiers {
  /** Platformer/runner gravity; the shooter reads it as vertical drift. */
  readonly gravityScale: number
  readonly playerSpeedScale: number
  /** Hazard density | enemy wave rate | obstacle rate, per mode. */
  readonly spawnRateScale: number
  readonly projectileSpeedScale: number
  readonly scoreMultiplier: number
  // --- chaos flags: at most one active at a time (see HeuristicDirector) ---
  readonly invertControls: boolean
  readonly mirrorWorld: boolean
  readonly fogOfWar: boolean
  // --- pacing ---
  readonly shiftDurationMs: number
}

/**
 * A mutable, partial StageModifiers, for code that BUILDS a set of modifiers
 * (the director, the dev overrides). StageModifiers itself is readonly so
 * that a scene can never mutate the stage it is running under.
 */
export type ModifierDraft = { -readonly [K in keyof StageModifiers]?: StageModifiers[K] }

/** A snapshot of how the player did, covering one shift window. */
export interface RunMetrics {
  readonly mode: GameMode
  readonly windowMs: number
  readonly shotsFired: number
  readonly shotsHit: number
  readonly damageTaken: number
  readonly pickups: number
  readonly jumps: number
  /** Mean ms between a threat appearing and the player reacting; 0 if unsampled. */
  readonly avgReactionMs: number
  /** Health as a 0..1 fraction at the moment of the snapshot. */
  readonly healthFraction: number
  /** Cumulative ms played in each mode across the whole run. */
  readonly msPerMode: Readonly<Record<GameMode, number>>
}

/** What the director decides for the upcoming stage. */
export interface StagePlan {
  readonly mode: GameMode
  readonly modifiers: StageModifiers
  /** Short human-readable reasons, surfaced on the glitch overlay. */
  readonly notes: readonly string[]
}

/**
 * The seam a future LLM-backed director implements. `decide` is synchronous
 * by design: it is called 3s ahead of the shift, and a stage plan must always
 * be available on time. An async implementation belongs behind a cache that
 * falls back to the heuristic, not behind a change to this signature.
 */
export interface Director {
  decide(metrics: RunMetrics, history: DirectorHistory): StagePlan
}

/** What the director is allowed to know about earlier stages. */
export interface DirectorHistory {
  readonly shiftIndex: number
  readonly currentMode: GameMode
  /** Modes played so far, oldest first. */
  readonly modeHistory: readonly GameMode[]
  /** True if the previous stage already had a chaos flag on. */
  readonly chaosLastStage: boolean
}
