import type { ModifierDraft } from '../../director/types.ts'

/**
 * A player- (or playtester-) facing difficulty knob, independent of the
 * Director. The Director already adapts modifiers live during a run; this
 * exists for the case that predates any telemetry -- the opening stage, or a
 * deliberately gentle/brutal session for testing -- where there is nothing
 * to adapt to yet.
 *
 * Only platformer has actual level DATA to curate (see easyPlatformerLevels.ts
 * and levelCheck.ts) -- shooter and runner have no terrain or level file at
 * all, they generate live from these same modifiers every stage, so "an easy
 * level" for them just means "the easy end of the modifier range", already
 * proven safe by validate-runner across the FULL clamped range. There is
 * nothing further to author for those two modes.
 */
export const LEVEL_DIFFICULTY = {
  Easy: 'easy',
  Normal: 'normal',
  Hard: 'hard',
} as const
export type LevelDifficulty = (typeof LEVEL_DIFFICULTY)[keyof typeof LEVEL_DIFFICULTY]

/**
 * Mode-agnostic, same as StageModifiers itself: every field here sits inside
 * the range clampModifiers() enforces (see director/modifiers.ts RANGE), so
 * applying one is always safe even before it reaches the clamp. Which fields
 * matter depends on which scene is running --
 *   PlatformerScene reads spawnRateScale, playerSpeedScale, gravityScale;
 *   RunnerScene reads spawnRateScale, gravityScale, playerSpeedScale;
 *   SpaceShooterScene reads spawnRateScale, projectileSpeedScale, gravityScale.
 *
 * Easy lowers gravityScale (a floatier arc reads as gentler in every mode: a
 * longer hang time in the platformer and runner, a slower vertical drift in
 * the shooter) and sits every density/speed dial at or near its clamp floor.
 * Hard is the mirror image, kept short of the absolute ceiling so a stage is
 * merciless rather than actually unwinnable.
 */
export const DIFFICULTY_MODIFIERS: Readonly<Record<LevelDifficulty, ModifierDraft>> = {
  easy: {
    gravityScale: 0.7,
    playerSpeedScale: 1,
    spawnRateScale: 0.5,
    projectileSpeedScale: 0.6,
  },
  normal: {
    gravityScale: 1,
    playerSpeedScale: 1,
    spawnRateScale: 1,
    projectileSpeedScale: 1,
  },
  hard: {
    gravityScale: 1.4,
    playerSpeedScale: 1.2,
    spawnRateScale: 1.8,
    projectileSpeedScale: 1.6,
  },
}

export function isLevelDifficulty(v: string): v is LevelDifficulty {
  return v === LEVEL_DIFFICULTY.Easy || v === LEVEL_DIFFICULTY.Normal || v === LEVEL_DIFFICULTY.Hard
}
