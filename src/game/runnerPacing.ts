import {
  RUNNER_JUMP_APEX_PX,
  RUNNER_MAX_SCROLL_SPEED,
  RUNNER_REACTION_BUFFER_MIN_SEC,
  RUNNER_REACTION_BUFFER_SEC,
  RUNNER_SCROLL_SPEED,
  RUNNER_SPEED_CAP,
  TILE_SIZE,
  VIEW_H,
} from './constants.ts'

// --- geometry -------------------------------------------------------------
// Lives here rather than in RunnerScene so validate-runner can assert against
// the REAL numbers instead of hand-copied literals that silently drift.

export const GROUND_Y = VIEW_H - TILE_SIZE * 2
/** Sprite centre when standing on the floor. */
export const FEET_Y = GROUND_Y - 8

/** Standing body. */
export const BODY_STAND = { w: 10, h: 14, ox: 3, oy: 1 } as const
/** Sliding body: short enough to clear a ceiling gate. */
export const BODY_SLIDE = { w: 12, h: 7, ox: 2, oy: 8 } as const

/**
 * The gate hangs from the top of the view down to here. Chosen against the two
 * bodies rather than by eye:
 *   standing body  146..160 -> overlaps a gate ending at 148  (hit)
 *   sliding body   152..159 -> clears it                      (safe)
 *   jumping        rises into the gate's column               (hit)
 */
export const GATE_BOTTOM_Y = 148

/**
 * Body bottom edge when resting on the floor. Both bodies deliberately share
 * it (oy + h === 15 for each), so the resting line does not move when the
 * player slides -- validate-runner asserts that.
 */
export const REST_BOTTOM = FEET_Y - 8 + BODY_STAND.oy + BODY_STAND.h

/**
 * The runner's pacing maths, kept pure and out of the scene so it can be
 * asserted by `npm run validate-runner`.
 *
 * This exists because of a real bug: obstacle spawning used to be purely
 * time-based, so the director's `spawnRateScale = 1.45` (its reward for good
 * shooting) produced 180px gaps against a 213px jump arc. You landed on the
 * next obstacle no matter what you did, and nothing in the codebase could
 * have caught it -- it only showed up as "the jump feels too weak".
 */

/**
 * Ground resolution for the runner's manual floor.
 *
 * Takes the BODY's bottom edge and velocity -- never the sprite's position.
 * Phaser's order within a frame is:
 *
 *   world.update  (bodies integrate)  ->  scene.update  ->  world.postUpdate
 *                                                           (sprite <- body)
 *
 * so inside scene.update the sprite is still where the PREVIOUS frame left
 * it. Reading it meant the clamp fired on the frame after a jump launched,
 * saw "still on the ground", and zeroed the upward velocity: the jump
 * collapsed from 64px to 5.4px and the player could not clear a 15px block.
 *
 * The `velocityY >= 0` guard is the second half of that fix -- a body moving
 * upward is never grounded, whatever its position says.
 */
export function resolveGround(
  bodyBottom: number,
  velocityY: number,
): { lift: number; onGround: boolean } {
  const overshoot = bodyBottom - REST_BOTTOM
  if (overshoot >= 0 && velocityY >= 0) return { lift: overshoot, onGround: true }
  return { lift: 0, onGround: false }
}

/** Launch velocity for a fixed apex under the given gravity (negative = up). */
export function jumpVelocity(gravityY: number): number {
  return -Math.sqrt(2 * gravityY * RUNNER_JUMP_APEX_PX)
}

/**
 * Seconds airborne on a full jump. Note this SHRINKS as gravity rises while
 * the apex stays put -- gravityScale changes the feel, not the capability.
 */
export function jumpArcSec(gravityY: number): number {
  return (2 * Math.abs(jumpVelocity(gravityY))) / gravityY
}

/**
 * Slack between landing and the next obstacle arriving. The director's
 * spawnRateScale spends this, and only this.
 */
export function reactionBufferSec(spawnRateScale: number): number {
  return Math.max(RUNNER_REACTION_BUFFER_MIN_SEC, RUNNER_REACTION_BUFFER_SEC / spawnRateScale)
}

/**
 * Minimum world distance between consecutive obstacles: enough for the player
 * to finish a full jump and be back on the ground with the buffer to spare.
 */
export function minGapPx(
  scrollSpeed: number,
  gravityY: number,
  spawnRateScale: number,
): number {
  return (
    scrollSpeed * (jumpArcSec(gravityY) + reactionBufferSec(spawnRateScale)) + TILE_SIZE
  )
}

/**
 * Scroll speed at `progress` (0..1) through the stage. Capped AFTER the
 * modifier, so a fast stage reaches the ceiling sooner but can never shrink
 * the reaction window past what a player can read an obstacle in.
 */
export function scrollSpeedAt(progress: number, playerSpeedScale: number): number {
  const ramped =
    RUNNER_SCROLL_SPEED +
    (RUNNER_MAX_SCROLL_SPEED - RUNNER_SCROLL_SPEED) * Math.min(1, Math.max(0, progress))
  return Math.min(RUNNER_SPEED_CAP, ramped * playerSpeedScale)
}

/**
 * Seconds the player spends on the ground between clearing one obstacle and
 * the next arriving. Must stay positive for every reachable stage; that is
 * the invariant validate-runner enforces.
 */
export function landingSlackSec(
  scrollSpeed: number,
  gravityY: number,
  spawnRateScale: number,
): number {
  return minGapPx(scrollSpeed, gravityY, spawnRateScale) / scrollSpeed - jumpArcSec(gravityY)
}
