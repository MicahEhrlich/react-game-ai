import {
  BALL_GRAVITY_RAMP,
  BALL_MAX_DEFLECT_DEG,
  BALL_MIN_VX_FRACTION,
  BALL_MIN_VY_FRACTION,
  BALL_R,
  BALL_SPEED,
  BALL_SPEED_CAP,
  BRICK_COLS,
  BRICK_H,
  BRICK_MAX_ROWS,
  BRICK_W,
  BRICK_WALL_TOP_Y,
  BRICK_WALL_X0,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_Y,
  VIEW_H,
} from './constants.ts'
import { randInt } from './rng.ts'
import type { Rng } from './rng.ts'

/**
 * BREAKDOWN's geometry, speeds and direction algebra -- pure, and with no
 * Phaser import, so `npm run validate-brick` can assert against the REAL
 * numbers the game runs on instead of hand-copied literals that drift.
 *
 * The third instance of the pattern established by runnerPacing.ts and
 * platformerPacing.ts, and it exists for the same reason both of those do: a
 * combination of director modifiers that quietly makes a stage unwinnable is
 * invisible in play. It does not read as "this stage is impossible", it reads
 * as "the controls feel wrong", which points nowhere near the cause.
 *
 * EVERY formula the scene needs lives here, not just the ones the validator
 * checks. That is deliberate: a scene that recomputes a deflection inline
 * would leave validate-brick asserting about maths the game never executes --
 * a green test over a broken game. RunnerScene is the model; its gapClear()
 * calls minGapPx() rather than re-deriving it.
 */

// --- geometry -------------------------------------------------------------

/** Top edge of the paddle. */
export const PADDLE_TOP_Y = PADDLE_Y - PADDLE_H / 2

/** Ball CENTRE height at the moment it touches the paddle. */
export const PADDLE_HIT_Y = PADDLE_TOP_Y - BALL_R

/** Centre x of a brick column. */
export function brickX(col: number): number {
  return BRICK_WALL_X0 + col * BRICK_W + BRICK_W / 2
}

/** Centre y of a brick row. */
export function brickY(row: number): number {
  return BRICK_WALL_TOP_Y + row * BRICK_H
}

/** Bottom edge of the lowest row in a wall of `rows` rows. */
export function wallBottomY(rows: number): number {
  return brickY(rows - 1) + BRICK_H / 2
}

// --- modifiers -> world ---------------------------------------------------

export function paddleSpeed(playerSpeedScale: number): number {
  return PADDLE_SPEED * playerSpeedScale
}

/**
 * Ball speed at `progress` (0..1) through the stage.
 *
 * The cap is applied AFTER the ramp, so a stage with a steep ramp reaches the
 * ceiling sooner but can never exceed it -- the same shape as
 * runnerPacing.scrollSpeedAt, and the reason raising gravityScale can never
 * make a stage unwinnable.
 */
export function ballSpeedAt(
  progress: number,
  gravityScale: number,
  projectileSpeedScale: number,
): number {
  const p = Math.min(1, Math.max(0, progress))
  const ramp = 1 + (gravityScale - 1) * BALL_GRAVITY_RAMP * p
  return Math.min(BALL_SPEED_CAP, BALL_SPEED * projectileSpeedScale * ramp)
}

/**
 * Fastest the ball can ever travel HORIZONTALLY at a given speed. Bounded by
 * the minimum-|vy| rule, and this is what the paddle has to out-run: see
 * trackingRatio.
 */
export function maxBallVx(speed: number): number {
  return speed * Math.sqrt(1 - BALL_MIN_VY_FRACTION ** 2)
}

// --- direction algebra ----------------------------------------------------

/**
 * Forces a post-bounce velocity into the legal cone: never so flat that the
 * ball ping-pongs horizontally forever, never so upright that it becomes a
 * metronome in one column.
 *
 * PRESERVES SPEED EXACTLY -- it is a rotation, not a boost. A version that
 * clamped vx and vy independently would add speed on every correction and walk
 * the ball straight past BALL_SPEED_CAP, which is the guarantee every
 * survivability check rests on. It also preserves the SIGN of vy: flipping it
 * would teleport the ball back through the brick it just hit.
 *
 * Only one of the two floors can ever engage, since
 * 0.35^2 + 0.15^2 < 1 -- correcting either leaves the other satisfied.
 */
export function clampMinVy(vx: number, vy: number, speed: number): { vx: number; vy: number } {
  const mag = Math.hypot(vx, vy)
  // A dead-stopped ball has no direction to preserve; send it down, which is
  // the only direction that cannot be immediately wrong.
  const nx = mag < 1e-6 ? 0 : vx / mag
  const ny = mag < 1e-6 ? 1 : vy / mag

  let outVx = nx * speed
  let outVy = ny * speed

  const minVy = BALL_MIN_VY_FRACTION * speed
  const minVx = BALL_MIN_VX_FRACTION * speed

  if (Math.abs(outVy) < minVy) {
    outVy = (outVy < 0 ? -1 : 1) * minVy
    outVx = (outVx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - minVy * minVy))
  } else if (Math.abs(outVx) < minVx) {
    outVx = (outVx < 0 ? -1 : 1) * minVx
    outVy = (outVy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - minVx * minVx))
  }

  return { vx: outVx, vy: outVy }
}

/**
 * Paddle english: where along the paddle you hit decides the outgoing angle,
 * so the player steers the ball rather than merely intercepting it.
 * `offset` is -1 (left edge) .. 0 (centre) .. 1 (right edge).
 *
 * Deliberately a pure rotation with NO clamping. BALL_MAX_DEFLECT_DEG is
 * chosen so even a full-edge hit keeps |vy| at 0.5 of speed -- above the
 * minimum -- which means clampMinVy never has to touch a paddle hit. That
 * matters because clamping here would flatten the control curve near the
 * centre and make the paddle feel like it has a dead zone.
 *
 * vy is always negative: a paddle hit that sent the ball downward would drop
 * it straight through the paddle and read as the paddle having failed.
 */
export function deflect(offset: number, speed: number): { vx: number; vy: number } {
  const o = Math.min(1, Math.max(-1, offset))
  const rad = (o * BALL_MAX_DEFLECT_DEG * Math.PI) / 180
  return { vx: Math.sin(rad) * speed, vy: -Math.cos(rad) * speed }
}

export function brickPlayDir(mirrorWorld: boolean): 1 | -1 {
  return mirrorWorld ? 1 : -1
}

export function brickPaddleY(mirrorWorld: boolean): number {
  return mirrorWorld ? VIEW_H - PADDLE_Y : PADDLE_Y
}

export function orientedBrickY(normalY: number, mirrorWorld: boolean): number {
  return mirrorWorld ? VIEW_H - normalY : normalY
}

export function ballSpawnY(mirrorWorld: boolean): number {
  return brickPaddleY(mirrorWorld) + brickPlayDir(mirrorWorld) * 18
}

export function paddleHitY(mirrorWorld: boolean): number {
  return brickPaddleY(mirrorWorld) + brickPlayDir(mirrorWorld) * (PADDLE_H / 2 + BALL_R + 0.5)
}

export function ballLost(y: number, mirrorWorld: boolean): boolean {
  return mirrorWorld ? y < -BALL_R : y > VIEW_H + BALL_R
}

export function deflectForOrientation(
  offset: number,
  speed: number,
  mirrorWorld: boolean,
): { vx: number; vy: number } {
  const out = deflect(offset, speed)
  return { vx: out.vx, vy: Math.abs(out.vy) * brickPlayDir(mirrorWorld) }
}

// --- wall layout ----------------------------------------------------------

export interface BrickSpec {
  readonly col: number
  readonly row: number
  readonly x: number
  readonly y: number
  /** 2 for the top row of a multi-row wall (cracks first, then breaks). */
  readonly hits: 1 | 2
}

/** Wall depth. Always at least one row: an empty wall satisfies the clear
 *  condition on frame one, which loops forever and reads as a freeze. */
export function brickRows(spawnRateScale: number): number {
  const rows = Math.round(spawnRateScale + 0.5)
  return Math.min(BRICK_MAX_ROWS, Math.max(1, rows))
}

/** How densely a row is filled. Higher spawnRateScale packs it tighter. */
export function brickFillChance(spawnRateScale: number): number {
  const t = (Math.min(2, Math.max(0.5, spawnRateScale)) - 0.5) / 1.5
  return 0.65 + 0.2 * t
}

/**
 * The wall for a stage.
 *
 * `mirrorWorld` reverses the column order rather than the pixel positions.
 * That is load-bearing: BREAKDOWN's playfield is left-right symmetric, so
 * unlike the other three modes there is nothing for worldDir to visibly flip,
 * and an unmirrored-looking mirror stage reads as the game lying about its own
 * modifier. The per-row gaps are what make the reversal legible, so the layout
 * is never allowed to come out symmetric.
 */
/**
 * Mutates a two-element gap set in place so it can never be its own mirror
 * image. Only a pair summing to BRICK_COLS - 1 is symmetric; nudging either
 * element by 1 (wrapping, and stepping again on collision) breaks that sum
 * without changing the row's gap COUNT, which is what keeps this invisible
 * to brickFillChance's density tuning.
 */
function breakSymmetricPair(gaps: Set<number>): void {
  const [a, b] = [...gaps]
  if (a + b !== BRICK_COLS - 1) return

  let moved = (b + 1) % BRICK_COLS
  if (moved === a) moved = (b + 2) % BRICK_COLS
  gaps.delete(b)
  gaps.add(moved)
}

export function wallLayout(
  spawnRateScale: number,
  mirrorWorld: boolean,
  rng: Rng,
): readonly BrickSpec[] {
  const rows = brickRows(spawnRateScale)
  const fill = brickFillChance(spawnRateScale)
  const out: BrickSpec[] = []

  for (let row = 0; row < rows; row++) {
    // One or two gaps per row. A single gap is asymmetric by construction --
    // with BRICK_COLS even, g === BRICK_COLS - 1 - g has no integer solution.
    // Two gaps are NOT automatically asymmetric: {g1, g2} with
    // g1 + g2 === BRICK_COLS - 1 is its own mirror image, and roughly 1 in 7
    // random pairs land there. Measured: left unguarded, about 1% of stages
    // (concentrated at low spawnRateScale, where a wall is one row) produced
    // a fully mirror-symmetric wall -- the mirrorWorld chaos flag silently
    // invisible on those seeds. breakSymmetricPair() is the fix.
    const gaps = new Set<number>()
    const gapCount = rng() < fill ? 1 : 2
    for (let g = 0; g < gapCount; g++) {
      gaps.add(randInt(rng, 0, BRICK_COLS - 1))
    }
    if (gaps.size === 2) breakSymmetricPair(gaps)

    for (let col = 0; col < BRICK_COLS; col++) {
      if (gaps.has(col)) continue
      const placed = mirrorWorld ? BRICK_COLS - 1 - col : col
      out.push({
        col: placed,
        row,
        x: brickX(placed),
        y: brickY(row),
        // Only the top row of a deep wall is reinforced, so the reward for
        // digging upward is a tougher brick rather than a surprise.
        hits: rows > 1 && row === 0 ? 2 : 1,
      })
    }
  }

  // Every gap landing on the same columns in every row could empty the wall.
  if (out.length === 0) {
    out.push({ col: 0, row: 0, x: brickX(0), y: brickY(0), hits: 1 })
  }
  return out
}

// --- survivability --------------------------------------------------------

/**
 * (A) TRACKING DOMINANCE -- the load-bearing invariant, and BREAKDOWN's
 * equivalent of "the jump arc is not negotiable".
 *
 * If the paddle's top speed exceeds the ball's HORIZONTAL speed, a paddle
 * already under the ball can stay under it for the whole descent: |vx| is
 * constant between bounces, and a wall or brick reflection only flips its
 * sign at a moment when the paddle's positional error is zero. So a tracking
 * player is never in an unwinnable stage, for any combination in the clamped
 * modifier space. Scale-free -- it does not care about view width, wall depth
 * or fall height.
 *
 * Returns paddleSpeed / maxBallVx; validate-brick requires a real margin
 * above 1, not a tie.
 */
export function trackingRatio(
  playerSpeedScale: number,
  projectileSpeedScale: number,
  gravityScale: number,
  progress: number,
): number {
  const ball = ballSpeedAt(progress, gravityScale, projectileSpeedScale)
  return paddleSpeed(playerSpeedScale) / maxBallVx(ball)
}

/**
 * Fastest the ball can ever arrive: a straight vertical drop off the lowest
 * brick in the deepest legal wall. The worst case for reacting to it.
 */
export function shortestDescentSec(
  spawnRateScale: number,
  projectileSpeedScale: number,
  gravityScale: number,
  progress: number,
): number {
  const ball = ballSpeedAt(progress, gravityScale, projectileSpeedScale)
  const from = wallBottomY(brickRows(spawnRateScale)) + BALL_R
  return (PADDLE_HIT_Y - from) / ball
}

/**
 * (B) REACTION RECOVERY -- the human half of (A).
 *
 * A real player loses `reactionSec` before reversing, falling behind by
 * maxBallVx * reactionSec, then closes that gap at the DIFFERENCE of the two
 * speeds. Total time to be back under the ball, including the lost reaction.
 *
 * Deliberately conservative: it does not subtract the paddle's half-width,
 * even though the paddle only has to get within PADDLE_W/2 of the landing
 * point. That unspent slack is free margin.
 */
export function recoverySec(
  playerSpeedScale: number,
  projectileSpeedScale: number,
  gravityScale: number,
  progress: number,
  reactionSec: number,
): number {
  const ball = ballSpeedAt(progress, gravityScale, projectileSpeedScale)
  const vx = maxBallVx(ball)
  const closeRate = paddleSpeed(playerSpeedScale) - vx
  // Caller asserts (A) separately; this makes the failure loud rather than
  // returning a negative time that would silently look like a pass.
  if (closeRate <= 0) return Number.POSITIVE_INFINITY
  return (vx * reactionSec) / closeRate + reactionSec
}
