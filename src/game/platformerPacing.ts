import { GRAVITY_Y, JUMP_VELOCITY, RUN_SPEED_MAX, TILE_SIZE } from './constants.ts'

/**
 * The platformer's jump physics, pulled out of Avatar so a level generator
 * and its validators can share the exact numbers the player actually jumps
 * with -- no hand-copied ranges to drift out of sync.
 *
 * FIXES A LATENT BUG: Avatar used to launch every jump at a fixed
 * JUMP_VELOCITY while ModeScene.create() scales gravity by mods.gravityScale
 * (0.5-1.6). A fixed launch velocity under scaled gravity means
 * apex = v² / (2·gravityY·scale) -- so a gravityScale above ~1.1 silently
 * shrank the jump below the height generatePlatformer's pit widths and
 * platform rows assume are clearable. This is the exact bug CLAUDE.md
 * invariant 8 already documents and fixed for the runner via
 * runnerPacing.jumpVelocity(gravityY); the platformer just never got the
 * matching fix. It went unnoticed because the heuristic director never
 * raises gravityScale above 1 -- only ?mods= or a live LLM director would
 * ever hit it, and a shrunk jump reads as "the level is too hard", which
 * points nowhere near the cause.
 */

/** The apex every jump reaches, independent of gravityScale -- derived once
 *  from the base tuning (JUMP_VELOCITY at GRAVITY_Y, i.e. scale 1). */
export const JUMP_APEX_PX = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY_Y)

/** Launch velocity (negative = up) that reaches JUMP_APEX_PX under the given
 *  live gravity. gravityScale changes how the jump FEELS, never what it can
 *  clear. */
export function jumpVelocity(gravityY: number): number {
  return -Math.sqrt(2 * gravityY * JUMP_APEX_PX)
}

/** Seconds airborne on a full jump, launch to landing. */
export function jumpAirTimeSec(gravityY: number): number {
  return (2 * Math.abs(jumpVelocity(gravityY))) / gravityY
}

/** Furthest horizontal distance a full-speed running jump can clear, under
 *  the given live gravity and player speed. This is the real ceiling a
 *  level's pits and hazard runs have to stay under. */
export function maxJumpDistancePx(gravityY: number, playerSpeedScale: number): number {
  return RUN_SPEED_MAX * playerSpeedScale * jumpAirTimeSec(gravityY)
}

/** In tiles, for readable log output and level-generation reasoning. */
export function maxJumpDistanceTiles(gravityY: number, playerSpeedScale: number): number {
  return maxJumpDistancePx(gravityY, playerSpeedScale) / TILE_SIZE
}
