/**
 * The three microgame modes. `erasableSyntaxOnly` bans TS enums, so this is
 * the `as const` object + indexed-union idiom used throughout the codebase.
 */
export const MODE = {
  Platformer: 'platformer',
  Shooter: 'shooter',
  Runner: 'runner',
} as const
export type GameMode = (typeof MODE)[keyof typeof MODE]

export const ALL_MODES: readonly GameMode[] = [MODE.Platformer, MODE.Shooter, MODE.Runner]

export const MODE_LABEL: Readonly<Record<GameMode, string>> = {
  [MODE.Platformer]: 'PLATFORM',
  [MODE.Shooter]: 'STARFIGHT',
  [MODE.Runner]: 'OVERDRIVE',
}

export const PHASE = {
  Menu: 'menu',
  Playing: 'playing',
  /** Mid-transition: the glitch overlay is up and input is frozen. */
  Shifting: 'shifting',
  Paused: 'paused',
  GameOver: 'game-over',
} as const
export type GamePhase = (typeof PHASE)[keyof typeof PHASE]

/**
 * Discrete, low-frequency state only. NOTHING per-frame goes in here -- every
 * patch() notifies React through useSyncExternalStore.
 *
 * `secondsToShift` is the one derived-from-per-frame value, and it is
 * deliberately quantised to whole seconds before it reaches the store, so the
 * countdown costs one re-render per second rather than one per frame.
 */
export interface GameSnapshot {
  readonly phase: GamePhase
  readonly score: number
  readonly health: number
  readonly maxHealth: number
  /** Score multiplier, grows with clean play, resets on damage. */
  readonly multiplier: number
  readonly mode: GameMode
  /** Populated during PHASE.Shifting so the overlay can announce it. */
  readonly nextMode: GameMode | null
  /** 0 for the first stage of a run, incremented on every shift. */
  readonly shiftIndex: number
  readonly secondsToShift: number
  /** True for the final seconds before a shift, so the HUD can flash. */
  readonly shiftWarning: boolean
  /** Frozen at game over, for the score-submit form. */
  readonly lastRunScore: number
  /** Human-readable notes on what the director changed, for the overlay. */
  readonly lastDirectorNotes: readonly string[]
}

export type GameCommand =
  | { readonly type: 'START_RUN' }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'QUIT_TO_MENU' }
  /** Dev/debug: collapse the shift countdown to zero immediately. */
  | { readonly type: 'FORCE_SHIFT' }
