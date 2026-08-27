// Units: pixels, pixels/second, pixels/second². World scale is 16px/tile.

export const TILE_SIZE = 16
export const VIEW_W = 320
export const VIEW_H = 192

// --- Run-wide ---
/** A single health pool that carries across every mode shift. */
export const START_HEALTH = 100
export const MAX_MULTIPLIER = 8

// --- Platformer physics (ported from react-game, tuned for 16px tiles) ---
export const GRAVITY_Y = 900
export const JUMP_VELOCITY = -300 // apex = 300² / (2·900) = 50px ≈ 3.1 tiles
export const JUMP_CUT_VELOCITY = -120 // vy clamped to this on early release
export const MAX_FALL_SPEED = 400
export const RUN_SPEED_MAX = 105 // ≈ 6.5 tiles/s
export const ACCEL_GROUND = 1200 // 0 -> max in ~0.09s: snappy, still not instant
export const ACCEL_AIR = 700
export const DRAG_GROUND = 1600
export const DRAG_AIR = 300 // low air drag = floaty, committed jumps
export const COYOTE_MS = 100
export const JUMP_BUFFER_MS = 120

// --- Shooter ---
export const SHIP_SPEED = 130
export const SHOT_SPEED = 260
export const SHOT_COOLDOWN_MS = 190
export const ENEMY_SHOT_SPEED = 120
export const SHOOTER_SPAWN_MS = 1100

// --- Runner ---
export const RUNNER_SCROLL_SPEED = 150
/** The stage ramps from SCROLL_SPEED to this over its full duration. */
export const RUNNER_MAX_SCROLL_SPEED = 260
/**
 * Hard ceiling on scroll speed after playerSpeedScale is applied. Without it,
 * a 1.4x speed stage leaves 0.68s between an obstacle appearing and reaching
 * the player -- not enough to recognise it AND choose jump vs slide.
 */
export const RUNNER_SPEED_CAP = 300
export const RUNNER_SPAWN_MS = 900
export const RUNNER_SLIDE_MS = 420
/**
 * Jump height, not jump velocity. The launch velocity is derived from live
 * gravity (see RunnerScene.jumpVelocity), so the director's gravityScale
 * changes how the jump FEELS -- snappier or floatier -- without ever changing
 * what it can clear. A fixed velocity would make apex = v²/2g, silently
 * cutting the jump from 60px to 38px exactly when the stage gets harder.
 *
 * A low block needs 15px of clearance; the rest is deliberate margin.
 */
export const RUNNER_JUMP_APEX_PX = 64
/**
 * Breathing room added to the jump arc when spacing obstacles, at
 * spawnRateScale 1. The director's spawnRateScale divides this, so a denser
 * stage eats into the buffer -- and ONLY the buffer. The jump arc itself is
 * never negotiable, which is what keeps every stage survivable.
 */
export const RUNNER_REACTION_BUFFER_SEC = 0.3
/** The buffer floor. Below this, back-to-back obstacles stop being readable. */
export const RUNNER_REACTION_BUFFER_MIN_SEC = 0.12

// --- Brick (BREAKDOWN) ---
// Entity-prefixed (BRICK_/PADDLE_/BALL_) rather than mode-prefixed, matching
// the shooter's SHIP_/SHOT_ style. The maths that consumes these lives in
// game/brickPacing.ts, pure and Phaser-free, so validate-brick can assert the
// real numbers rather than copies.

export const BRICK_COLS = 8
export const BRICK_W = 32
export const BRICK_H = 16
export const BRICK_MAX_ROWS = 3
/** Left edge of the wall. 32 + 8*32 = 288, leaving a 32px margin each side. */
export const BRICK_WALL_X0 = 32
/** Centre of the top brick row. Rows step down by BRICK_H from here. */
export const BRICK_WALL_TOP_Y = 26
/** A ball rattling with nothing to show for it for this long gets kicked
 *  toward the wall. Backstop only -- the real anti-stall is the minimum
 *  vertical velocity fraction below. */
export const BRICK_STALL_MS = 4000

export const PADDLE_Y = 178
export const PADDLE_W = 48
export const PADDLE_H = 8
/** Instant velocity, not acceleration: InputState has no analog axis, so the
 *  paddle is driven by a -1|0|1 and an accel curve would feel broken. */
export const PADDLE_SPEED = 420

export const BALL_R = 3
export const BALL_SPEED = 140
/**
 * Hard ceiling on ball speed after projectileSpeedScale and the gravity ramp.
 * Load-bearing, exactly like RUNNER_SPEED_CAP: uncapped, the fastest legal
 * stage puts the ball's HORIZONTAL speed above what the slowest legal paddle
 * can track, and no amount of skill intercepts it. validate-brick proves the
 * uncapped case would fail, so this can never be mistaken for belt-and-braces.
 */
export const BALL_SPEED_CAP = 195
/**
 * Floor on |vy| as a fraction of total speed. A ball trapped in a near-
 * horizontal bounce is both unwinnable and indistinguishable from a freeze;
 * this is what makes that shape unrepresentable rather than merely unlikely.
 */
export const BALL_MIN_VY_FRACTION = 0.35
/** Floor on |vx|, so a bounce cannot leave the ball a vertical metronome. */
export const BALL_MIN_VX_FRACTION = 0.15
/**
 * Widest angle off vertical a paddle hit can impart, in degrees. Chosen so a
 * full-edge hit still leaves |vy| = cos(60°) = 0.5 of total speed, comfortably
 * above BALL_MIN_VY_FRACTION -- which is what lets deflect() stay a pure,
 * monotonic rotation with no clamping to distort the player's control.
 */
export const BALL_MAX_DEFLECT_DEG = 60
/**
 * How much of gravityScale feeds the ball's speed ramp across a stage. The
 * world's gravity is 0 in this mode (invariant 9), so "the world pulls
 * harder" has to mean something else; here it means the stage tightens as it
 * runs. Real downward gravity was rejected -- it destroys the constant-speed
 * assumption every other piece of this maths rests on, and an accelerating
 * ball cannot be capped.
 */
export const BALL_GRAVITY_RAMP = 0.35

// --- Feel ---
export const INVULN_MS = 1000
export const INVULN_BLINK_MS = 80
export const RESPAWN_DELAY_MS = 700

// --- Bodies ---
export const PLAYER_BODY_W = 10
export const PLAYER_BODY_H = 14
export const PLAYER_BODY_OFF_X = 3
export const PLAYER_BODY_OFF_Y = 1

// --- Damage ---
export const DMG_HAZARD = 20
export const DMG_ENEMY = 15
export const DMG_PROJECTILE = 10
export const DMG_PIT = 25
export const DMG_OBSTACLE = 20
/** Losing the ball. Between a projectile (10) and an obstacle (20): six
 *  losses kill from full, so a bad stage costs you without ending the run. */
export const DMG_BALL_LOST = 15

// --- Scoring (pre-multiplier base values) ---
export const SCORE_PICKUP = 100
export const SCORE_KILL = 150
export const SCORE_DODGE = 25
export const SCORE_SURVIVE_SHIFT = 1000
/** One brick. Between a dodge (25) and a kill (150). */
export const SCORE_BRICK = 60
/** Clearing a whole wall, on top of the bricks themselves. */
export const SCORE_WALL_CLEAR = 500

// --- Shift engine ---
/** How far ahead of the shift the next stage is planned and the HUD warns. */
export const SHIFT_WARNING_MS = 3000
/** How long the glitch overlay covers the scene swap. */
export const GLITCH_DURATION_MS = 1100
/**
 * A longer hold when the incoming stage carries a chaos flag. The player has
 * to actually read "CONTROLS INVERTED" for it to be a challenge rather than a
 * bug, and 900ms was not enough.
 */
export const GLITCH_DURATION_CHAOS_MS = 1800

// --- Camera ---
export const CAM_LERP = 0.12
export const CAM_DEADZONE_W = 80
export const CAM_DEADZONE_H = VIEW_H

/**
 * Display-list ordering. Named rather than inline so a new object type can be
 * slotted in without hunting for the magic numbers it has to sit between.
 */
export const DEPTH = {
  Background: -20,
  Terrain: 0,
  Pickup: 5,
  Enemy: 10,
  Projectile: 15,
  Player: 20,
  Fog: 60,
  Corruption: 80,
} as const

// --- Platformer enemies ---
export const WALKER_SPEED = 40
export const FLYER_SPEED = 70
