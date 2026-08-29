/**
 * Structural check on BREAKDOWN's pacing, in the same shape as
 * validate-runner: a plain node script that fails loudly, because there is no
 * test framework here.
 *
 * What it guards, across the whole reachable modifier space:
 *   1. tracking dominance -- the paddle can always out-run the ball
 *      horizontally, so a paddle that stays under the ball is never beaten
 *      by the geometry alone;
 *   2. reaction recovery -- a real player, not a perfect one, can recover
 *      from the worst-case drop;
 *   3. the ball's speed cap actually bites, so raising projectileSpeedScale
 *      or gravityScale can never make a stage unwinnable;
 *   4. direction algebra never changes ball speed, never flips vy's sign on
 *      a wall bounce, and never sends a paddle hit downward;
 *   5. every wall is playable geometry, and mirrorWorld is never invisible;
 *   6. the ball can never tunnel through the paddle on a frame spike.
 */
import {
  brickFillChance,
  brickRows,
  brickX,
  brickY,
  ballLost,
  ballSpawnY,
  brickPaddleY,
  brickPlayDir,
  clampMinVy,
  deflect,
  deflectForOrientation,
  maxBallVx,
  orientedBrickY,
  paddleHitY,
  PADDLE_HIT_Y,
  PADDLE_TOP_Y,
  ballSpeedAt,
  paddleSpeed,
  recoverySec,
  shortestDescentSec,
  trackingRatio,
  wallBottomY,
  wallLayout,
} from '../src/game/brickPacing.ts'
import type { BrickSpec } from '../src/game/brickPacing.ts'
import {
  BALL_GRAVITY_RAMP,
  BALL_MIN_VX_FRACTION,
  BALL_MIN_VY_FRACTION,
  BALL_R,
  BALL_SPEED,
  BALL_SPEED_CAP,
  BRICK_COLS,
  BRICK_H,
  BRICK_MAX_ROWS,
  BRICK_W,
  BRICK_WALL_X0,
  PADDLE_H,
  PADDLE_Y,
  VIEW_H,
  VIEW_W,
} from '../src/game/constants.ts'
import { makeRng } from '../src/game/rng.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

// --- independent literals --------------------------------------------------
// Never the implementation's own constants: asserting against the constant
// the implementation already uses would make these checks circular, and they
// would pass no matter how the tuning moved.

/** ~150ms to see a thing and begin acting on it. */
const HUMAN_REACTION_SEC = 0.15
/** The paddle must genuinely out-run the ball, not merely tie it. */
const TRACK_MARGIN = 1.25
/**
 * Arcade's `fixedStep` defaults to true and `fps` to 60, and
 * createGameConfig pins neither -- so bodies integrate at a fixed 1/60s
 * regardless of the actual frame rate. That default is what the tunnelling
 * margin below actually depends on; if it ever changes (arcade: { fps: 30 }
 * or fixedStep: false), THIS is what should catch it, not a shipped
 * "the paddle doesn't work" bug discovered in play.
 */
const STEP_HZ = 60
/** Bricks must never reach within this of the paddle. */
const WALL_PADDLE_CLEARANCE_PX = 64

/** The full range clampModifiers permits, plus the neutral value. */
const GRAVITY_SCALES = [0.5, 0.75, 1, 1.3, 1.6]
const SPEED_SCALES = [0.7, 1, 1.2, 1.4]
const SPAWN_SCALES = [0.5, 1, 1.45, 1.75, 2]
const PROJECTILE_SCALES = [0.6, 1, 1.2, 1.5, 1.8]
const PROGRESS = [0, 0.25, 0.5, 0.75, 1]

console.log('validate-brick')

// --- 1: tracking dominance --------------------------------------------------
// If the paddle cannot out-run the ball horizontally, no amount of skill
// intercepts it -- the stage is unwinnable regardless of reaction time.
for (const gs of GRAVITY_SCALES) {
  for (const ps of SPEED_SCALES) {
    for (const pj of PROJECTILE_SCALES) {
      for (const p of PROGRESS) {
        const ratio = trackingRatio(ps, pj, gs, p)
        const at = `gravity ${gs} / speed ${ps} / projectile ${pj} / progress ${p}`
        if (!(ratio >= TRACK_MARGIN)) {
          fail(`${at}: tracking ratio ${ratio.toFixed(3)} < the ${TRACK_MARGIN} margin`)
        }
      }
    }
  }
}

// --- 2: reaction recovery ---------------------------------------------------
// Arithmetically survivable is not the same as humanly survivable: a real
// player needs real time on the paddle-under-the-ball line before the next
// drop arrives.
for (const gs of GRAVITY_SCALES) {
  for (const ps of SPEED_SCALES) {
    for (const pj of PROJECTILE_SCALES) {
      for (const ss of SPAWN_SCALES) {
        for (const p of PROGRESS) {
          const recovery = recoverySec(ps, pj, gs, p, HUMAN_REACTION_SEC)
          const descent = shortestDescentSec(ss, pj, gs, p)
          const at = `gravity ${gs} / speed ${ps} / projectile ${pj} / spawn ${ss} / progress ${p}`
          if (!(recovery <= descent)) {
            fail(
              `${at}: recovery ${recovery.toFixed(3)}s exceeds the shortest descent ${descent.toFixed(3)}s`,
            )
          }
        }
      }
    }
  }
}

// --- 3: readability ----------------------------------------------------
// Even a perfectly-tracking paddle needs the drop to be visible before it
// lands -- a bounce off the lowest brick must arrive slower than a blink.
for (const ss of SPAWN_SCALES) {
  for (const pj of PROJECTILE_SCALES) {
    for (const gs of GRAVITY_SCALES) {
      for (const p of PROGRESS) {
        const descent = shortestDescentSec(ss, pj, gs, p)
        if (!(descent >= HUMAN_REACTION_SEC)) {
          fail(
            `spawn ${ss} / projectile ${pj} / gravity ${gs} / progress ${p}: ` +
              `shortest descent ${descent.toFixed(3)}s is below the ${HUMAN_REACTION_SEC}s reaction floor`,
          )
        }
      }
    }
  }
}

// --- 4: the speed cap holds, including the gravity ramp --------------------
for (const gs of GRAVITY_SCALES) {
  for (const pj of PROJECTILE_SCALES) {
    for (const p of PROGRESS) {
      const speed = ballSpeedAt(p, gs, pj)
      if (speed > BALL_SPEED_CAP + 1e-9) {
        fail(`gravity ${gs} / projectile ${pj} / progress ${p}: ball speed ${speed} exceeds the cap ${BALL_SPEED_CAP}`)
      }
    }
  }
}

// --- 4b: the cap is load-bearing -- an inverted regression case ------------
// Proves an UNCAPPED ball would actually break tracking dominance somewhere
// in the space, so BALL_SPEED_CAP can never be mistaken for belt-and-braces
// and quietly removed. Written against paddleSpeed / TRACK_MARGIN, NOT
// against paddleSpeed directly: measured, the naive form (naiveVx >=
// paddleSpeed) does not trip anywhere in this sweep -- max uncapped vx comes
// out to ~285.6 against a minimum paddle speed of 294, which would make this
// arm permanently green and permanently useless.
{
  let tripped = false
  for (const gs of GRAVITY_SCALES) {
    for (const ps of SPEED_SCALES) {
      for (const pj of PROJECTILE_SCALES) {
        for (const p of PROGRESS) {
          const rampFactor = 1 + (gs - 1) * BALL_GRAVITY_RAMP * p
          const naiveSpeed = BALL_SPEED * pj * rampFactor // deliberately UNCAPPED
          const naiveVx = naiveSpeed * Math.sqrt(1 - BALL_MIN_VY_FRACTION ** 2)
          if (naiveVx >= paddleSpeed(ps) / TRACK_MARGIN) tripped = true
        }
      }
    }
  }
  if (!tripped) {
    fail(
      'BALL_SPEED_CAP is no longer load-bearing -- either the tuning moved or ' +
        'this regression case is stale; re-derive before trusting it',
    )
  }
}

// --- 5: clampMinVy is a pure rotation, never a boost ------------------------
{
  const speeds = [BALL_SPEED, (BALL_SPEED + BALL_SPEED_CAP) / 2, BALL_SPEED_CAP]
  for (const speed of speeds) {
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180
      const vx = Math.cos(rad) * speed
      const vy = Math.sin(rad) * speed
      const out = clampMinVy(vx, vy, speed)
      const mag = Math.hypot(out.vx, out.vy)
      const at = `clampMinVy(deg ${deg}, speed ${speed})`

      if (Math.abs(mag - speed) > 1e-6) {
        fail(`${at}: magnitude ${mag.toFixed(4)} != ${speed} -- a correction that boosts walks past the cap`)
      }
      if (Math.abs(out.vy) < BALL_MIN_VY_FRACTION * speed - 1e-6) {
        fail(`${at}: |vy| ${Math.abs(out.vy).toFixed(2)} below the min-vy floor`)
      }
      if (Math.abs(out.vx) < BALL_MIN_VX_FRACTION * speed - 1e-6) {
        fail(`${at}: |vx| ${Math.abs(out.vx).toFixed(2)} below the min-vx floor`)
      }
      if (vy !== 0 && Math.sign(out.vy) !== Math.sign(vy)) {
        fail(`${at}: flipped the sign of vy -- would teleport the ball back through the brick it just hit`)
      }

      const again = clampMinVy(out.vx, out.vy, speed)
      if (Math.abs(again.vx - out.vx) > 1e-6 || Math.abs(again.vy - out.vy) > 1e-6) {
        fail(`${at}: not idempotent`)
      }
    }

    const zero = clampMinVy(0, 0, speed)
    if (Math.abs(Math.hypot(zero.vx, zero.vy) - speed) > 1e-6) {
      fail(`clampMinVy(0, 0, ${speed}): degenerate input did not produce a full-speed vector`)
    }
  }
}

// --- 5b: deflect (paddle english) -------------------------------------------
{
  const speeds = [BALL_SPEED, BALL_SPEED_CAP]
  for (const speed of speeds) {
    let prevVx = Number.NEGATIVE_INFINITY
    for (let raw = -1; raw <= 1.0001; raw += 0.02) {
      const offset = Math.min(1, raw)
      const out = deflect(offset, speed)
      const mag = Math.hypot(out.vx, out.vy)
      const at = `deflect(${offset.toFixed(2)}, ${speed})`

      if (Math.abs(mag - speed) > 1e-6) fail(`${at}: magnitude ${mag.toFixed(4)} != ${speed}`)
      if (out.vy >= 0) fail(`${at}: vy is not negative (${out.vy}) -- a paddle hit must never send the ball down`)
      // Ties english back to invariant 1: an angle wider than the tracking
      // cone would break tracking dominance from the single most common
      // source of a velocity change.
      if (Math.abs(out.vx) > maxBallVx(speed) + 1e-6) {
        fail(`${at}: |vx| ${Math.abs(out.vx).toFixed(2)} exceeds maxBallVx ${maxBallVx(speed).toFixed(2)}`)
      }
      if (out.vx < prevVx - 1e-9) fail(`${at}: not monotonic in offset -- the control would not be legible`)
      prevVx = out.vx
    }
  }
}

// --- 5c: mirrorWorld flips BREAKDOWN vertically ----------------------------
{
  if (brickPaddleY(false) !== PADDLE_Y) fail('normal brick paddle is not at the bottom tuning point')
  if (brickPaddleY(true) !== VIEW_H - PADDLE_Y) fail('mirrored brick paddle is not reflected to the top')
  if (brickPlayDir(false) !== -1 || brickPlayDir(true) !== 1) {
    fail('brickPlayDir does not point normal up and mirrored down')
  }

  const normal = deflectForOrientation(0, BALL_SPEED, false)
  const mirrored = deflectForOrientation(0, BALL_SPEED, true)
  if (normal.vy >= 0) fail('normal paddle hit does not send the ball upward')
  if (mirrored.vy <= 0) fail('mirrored paddle hit does not send the ball downward')
  if (!(paddleHitY(false) < brickPaddleY(false))) fail('normal paddle hit point is not above the paddle')
  if (!(paddleHitY(true) > brickPaddleY(true))) fail('mirrored paddle hit point is not below the paddle')
  if (!(ballSpawnY(false) < brickPaddleY(false))) fail('normal ball spawn is not above the paddle')
  if (!(ballSpawnY(true) > brickPaddleY(true))) fail('mirrored ball spawn is not below the paddle')
  if (!ballLost(VIEW_H + BALL_R + 1, false)) fail('normal ball loss does not trigger below screen')
  if (ballLost(-BALL_R - 1, false)) fail('normal ball loss triggers above screen')
  if (!ballLost(-BALL_R - 1, true)) fail('mirrored ball loss does not trigger above screen')
  if (ballLost(VIEW_H + BALL_R + 1, true)) fail('mirrored ball loss triggers below screen')

  const mirroredTopRowY = orientedBrickY(brickY(0), true)
  if (!(mirroredTopRowY > VIEW_H / 2)) fail('mirrored brick wall is not near the bottom half')
  if (!(mirroredTopRowY + BRICK_H / 2 < VIEW_H)) fail('mirrored brick wall extends out of bounds')
  if (!(brickPaddleY(true) + PADDLE_H + WALL_PADDLE_CLEARANCE_PX < mirroredTopRowY)) {
    fail('mirrored brick wall does not leave safe clearance from top paddle')
  }
}

// --- 6: wall geometry --------------------------------------------------------
{
  for (const ss of SPAWN_SCALES) {
    const rows = brickRows(ss)
    if (!(rows >= 1)) {
      fail(`brickRows(${ss}) = ${rows} -- an empty wall satisfies the clear condition on frame 1 and loops forever`)
    }
    if (!(rows <= BRICK_MAX_ROWS)) fail(`brickRows(${ss}) = ${rows} exceeds BRICK_MAX_ROWS ${BRICK_MAX_ROWS}`)

    const fill = brickFillChance(ss)
    if (!(fill >= 0 && fill <= 1)) fail(`brickFillChance(${ss}) = ${fill} is outside [0, 1]`)
  }

  const bottom = wallBottomY(BRICK_MAX_ROWS)
  if (!(bottom + WALL_PADDLE_CLEARANCE_PX <= PADDLE_TOP_Y)) {
    fail(`deepest wall bottom ${bottom}px + ${WALL_PADDLE_CLEARANCE_PX}px clearance exceeds paddle top ${PADDLE_TOP_Y}px`)
  }
  if (!(PADDLE_HIT_Y < PADDLE_TOP_Y)) fail(`PADDLE_HIT_Y ${PADDLE_HIT_Y} is not above PADDLE_TOP_Y ${PADDLE_TOP_Y}`)
  if (!(BRICK_WALL_X0 >= 0 && BRICK_WALL_X0 + BRICK_COLS * BRICK_W <= VIEW_W)) {
    fail(`wall spans [${BRICK_WALL_X0}, ${BRICK_WALL_X0 + BRICK_COLS * BRICK_W}], outside [0, ${VIEW_W}]`)
  }

  // Every seed x spawnRateScale combination produces a non-empty wall in
  // bounds, and mirrorWorld is never invisible. 300 seeds is what proved the
  // pre-fix symmetric-pair bug (~1% of combinations) and is comfortably
  // beyond the 4/28 per-row odds that produced it.
  const norm = (specs: readonly BrickSpec[]) =>
    JSON.stringify([...specs].map((s) => [s.row, s.col]).sort((a, b) => a[0] - b[0] || a[1] - b[1]))

  for (let seed = 1; seed <= 300; seed++) {
    for (const ss of SPAWN_SCALES) {
      const rows = brickRows(ss)
      const normal = wallLayout(ss, false, makeRng(seed))
      const mirrored = wallLayout(ss, true, makeRng(seed))
      const at = `wallLayout(${ss}, seed ${seed})`

      if (normal.length === 0) fail(`${at}: produced an empty wall`)
      if (mirrored.length === 0) fail(`${at} mirrored: produced an empty wall`)

      if (norm(normal) === norm(mirrored)) {
        fail(`${at}: mirrorWorld produced an IDENTICAL wall -- the chaos flag would be invisible on this seed`)
      }

      for (const b of [...normal, ...mirrored]) {
        if (b.col < 0 || b.col >= BRICK_COLS) fail(`${at}: brick col ${b.col} out of range`)
        if (b.row < 0 || b.row >= rows) fail(`${at}: brick row ${b.row} out of range`)
        if (b.x !== brickX(b.col) || b.y !== brickY(b.row)) {
          fail(`${at}: brick at (${b.col},${b.row}) has pixel position drifted from brickX/brickY`)
        }
      }
    }
  }
}

// --- 7: the ball cannot tunnel through the paddle on a frame spike ---------
{
  const perStep = BALL_SPEED_CAP / STEP_HZ
  const clearance = PADDLE_H + 2 * BALL_R
  if (!(perStep < clearance)) {
    fail(
      `ball travels ${perStep.toFixed(2)}px per physics step at the speed cap, >= the ` +
        `${clearance}px paddle+ball clearance -- it can pass through without a collision ever firing`,
    )
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  every reachable BREAKDOWN stage is survivable')
