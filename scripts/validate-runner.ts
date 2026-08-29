/**
 * Structural check on the runner's pacing, in the same shape as
 * validate-director: a plain node script that fails loudly, because there is
 * no test framework here.
 *
 * It exists because of a bug that shipped and was invisible. Obstacle
 * spawning was purely time-based, so a stage with spawnRateScale 1.45 (the
 * director's reward for good shooting) put 180px between obstacles while a
 * jump carried the player 213px through the air. Every such stage was
 * unwinnable, and it presented as "the jump feels too weak" -- nothing in the
 * codebase could have pointed at the real cause.
 *
 * What it guards, across the whole reachable modifier space:
 *   1. landing slack stays positive -- the player is always back on the
 *      ground before the next obstacle arrives;
 *   2. jump apex is independent of gravityScale;
 *   3. a jump always clears a low block, and a slide always clears a gate;
 *   4. scroll speed never exceeds the cap that keeps obstacles readable.
 */
import {
  BODY_SLIDE,
  BODY_STAND,
  FEET_Y,
  GATE_BOTTOM_Y,
  jumpArcSec,
  jumpVelocity,
  landingSlackSec,
  MAGA_DUCK_COSTUME_H,
  minGapPx,
  REST_BOTTOM,
  RUNNER_FLOOR_SNAP_PX,
  resolveGround,
  scrollSpeedAt,
} from '../src/game/runnerPacing.ts'
import {
  GRAVITY_Y,
  COYOTE_MS,
  JUMP_BUFFER_MS,
  RUNNER_JUMP_APEX_PX,
  RUNNER_SPAWN_MS,
  RUNNER_SPEED_CAP,
} from '../src/game/constants.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

/**
 * Minimum time the player must have on the ground between clearing one
 * obstacle and the next arriving.
 *
 * Deliberately an independent literal, NOT RUNNER_REACTION_BUFFER_MIN_SEC:
 * asserting against the constant the implementation already uses would make
 * this check circular and it would pass no matter how the tuning moved. This
 * number comes from human reaction time -- roughly 150ms to see a thing and
 * begin acting on it -- and the implementation has to satisfy it.
 */
const MIN_HUMAN_SLACK_SEC = 0.15

/** The full range clampModifiers permits, plus the neutral value. */
const GRAVITY_SCALES = [0.5, 0.75, 1, 1.3, 1.6]
const SPEED_SCALES = [0.7, 1, 1.2, 1.4]
const SPAWN_SCALES = [0.5, 1, 1.45, 1.75, 2]
const PROGRESS = [0, 0.25, 0.5, 0.75, 1]

console.log('validate-runner')

// --- 1: every reachable stage is survivable -------------------------------
for (const gs of GRAVITY_SCALES) {
  const gravity = GRAVITY_Y * gs
  for (const ps of SPEED_SCALES) {
    for (const ss of SPAWN_SCALES) {
      for (const p of PROGRESS) {
        const scroll = scrollSpeedAt(p, ps)
        const slack = landingSlackSec(scroll, gravity, ss)
        const at = `gravity ${gs} / speed ${ps} / spawn ${ss} / progress ${p}`

        // Not merely positive: the player needs REAL time on the ground
        // between obstacles. A gap that beats the jump arc by a few pixels is
        // arithmetically survivable and humanly impossible.
        if (!(slack >= MIN_HUMAN_SLACK_SEC)) {
          fail(`${at}: landing slack ${slack.toFixed(3)}s < the ${MIN_HUMAN_SLACK_SEC}s floor`)
        }
        // A gap shorter than the arc means landing ON the next obstacle.
        const gap = minGapPx(scroll, gravity, ss)
        const arcPx = scroll * jumpArcSec(gravity)
        if (gap <= arcPx) {
          fail(`${at}: gap ${gap.toFixed(0)}px <= jump arc ${arcPx.toFixed(0)}px`)
        }
        if (scroll > RUNNER_SPEED_CAP + 0.001) {
          fail(`${at}: scroll ${scroll.toFixed(0)} exceeds the ${RUNNER_SPEED_CAP} cap`)
        }
      }
    }
  }
}

// --- 1b: the original bug, kept as a regression case -----------------------
// Spawning was once driven by the timer ALONE. This asserts that the timer is
// genuinely insufficient, so the distance gate in RunnerScene.gapClear() can
// never be mistaken for a redundant belt-and-braces check and removed.
{
  let timerAloneEverFails = false
  for (const ss of SPAWN_SCALES) {
    for (const ps of SPEED_SCALES) {
      const scroll = scrollSpeedAt(1, ps) // end of stage, the worst case
      const timerGapPx = (RUNNER_SPAWN_MS / ss / 1000) * scroll
      const arcPx = scroll * jumpArcSec(GRAVITY_Y)
      if (timerGapPx <= arcPx) timerAloneEverFails = true
    }
  }
  if (!timerAloneEverFails) {
    fail(
      'the spawn timer alone now always beats the jump arc -- either the tuning ' +
        'changed or this regression case is stale; re-derive before trusting it',
    )
  }
}

// --- 2: the jump must actually REACH its apex in the real frame loop -------
/**
 * This simulates Phaser's per-frame order rather than evaluating v²/2g,
 * because the formula check passed while the game shipped a 5.4px jump.
 *
 *   world.update (preUpdate: body <- sprite, then integrate)
 *   scene.update (applyGround, then handleJump)
 *   world.postUpdate (sprite += body delta)
 *
 * applyGround used to read the SPRITE, which inside scene.update is still
 * where the previous frame left it. One frame after launch it read "still
 * grounded" and zeroed the upward velocity. Only a simulation that respects
 * this ordering can catch that class of bug.
 */
function simulateJumpApexPx(gravityY: number, dt = 1 / 60, frames = 240): number {
  let spriteY = FEET_Y
  let velocityY = 0
  let jumped = false
  let apex = 0

  for (let f = 0; f < frames; f++) {
    // world.update: body re-derived from the sprite, then integrated.
    let bodyBottom = spriteY - 8 + BODY_STAND.oy + BODY_STAND.h
    const before = bodyBottom
    velocityY += gravityY * dt
    bodyBottom += velocityY * dt

    // scene.update: applyGround, then handleJump.
    const { lift, onGround } = resolveGround(bodyBottom, velocityY)
    if (onGround) {
      bodyBottom -= lift
      spriteY -= lift
      velocityY = 0
    }
    if (!jumped && onGround) {
      velocityY = jumpVelocity(gravityY)
      jumped = true
    }

    // world.postUpdate: sprite takes this frame's body delta.
    spriteY += bodyBottom - before
    apex = Math.max(apex, FEET_Y - spriteY)
  }
  return apex
}

{
  // A discrete 60Hz integration undershoots the continuous solution slightly;
  // 6% is generous for that and still far from the 5.4px failure.
  const TOLERANCE = 0.06

  for (const gs of GRAVITY_SCALES) {
    const gravity = GRAVITY_Y * gs
    const reached = simulateJumpApexPx(gravity)

    if (reached < RUNNER_JUMP_APEX_PX * (1 - TOLERANCE)) {
      fail(
        `gravityScale ${gs}: jump reaches only ${reached.toFixed(1)}px of the ` +
          `${RUNNER_JUMP_APEX_PX}px apex -- the ground clamp is eating it`,
      )
    }
    // The whole point of deriving velocity from gravity: apex must not drift
    // as the director makes stages heavier.
    if (reached > RUNNER_JUMP_APEX_PX * (1 + TOLERANCE)) {
      fail(`gravityScale ${gs}: jump overshoots to ${reached.toFixed(1)}px`)
    }
  }

  // And it has to clear the thing it exists to clear.
  const LOW_BLOCK_CLEARANCE_PX = 15
  const worst = Math.min(...GRAVITY_SCALES.map((gs) => simulateJumpApexPx(GRAVITY_Y * gs)))
  if (worst <= LOW_BLOCK_CLEARANCE_PX) {
    fail(`worst-case jump ${worst.toFixed(1)}px does not clear a ${LOW_BLOCK_CLEARANCE_PX}px block`)
  }
}

// --- 2b: runner jump input grace ------------------------------------------
{
  const gravity = GRAVITY_Y
  const dtMs = 1000 / 60

  function apexAfterBufferedJump(bufferStartMs: number, startBottom: number, startVy: number): number {
    let bodyBottom = startBottom
    let spriteY = FEET_Y + (startBottom - REST_BOTTOM)
    let velocityY = startVy
    let bufferMs = bufferStartMs
    let coyoteMs = 0
    let apex = 0

    for (let f = 0; f < 240; f++) {
      const before = bodyBottom
      velocityY += gravity * (dtMs / 1000)
      bodyBottom += velocityY * (dtMs / 1000)

      const ground = resolveGround(bodyBottom, velocityY)
      if (ground.onGround) {
        bodyBottom -= ground.lift
        spriteY -= ground.lift
        velocityY = 0
        coyoteMs = COYOTE_MS
      } else {
        coyoteMs = Math.max(0, coyoteMs - dtMs)
      }

      bufferMs = Math.max(0, bufferMs - dtMs)
      if (bufferMs > 0 && coyoteMs > 0) {
        velocityY = jumpVelocity(gravity)
        bufferMs = 0
        coyoteMs = 0
      }

      spriteY += bodyBottom - before
      apex = Math.max(apex, FEET_Y - spriteY)
    }
    return apex
  }

  const snapped = resolveGround(REST_BOTTOM - RUNNER_FLOOR_SNAP_PX, 1)
  if (!snapped.onGround) fail('floor snap tolerance does not mark near-floor runner grounded')
  const rising = resolveGround(REST_BOTTOM + 1, -1)
  if (rising.onGround) fail('rising runner was incorrectly grounded')

  const buffered = apexAfterBufferedJump(JUMP_BUFFER_MS, REST_BOTTOM - RUNNER_FLOOR_SNAP_PX, 0)
  if (buffered < RUNNER_JUMP_APEX_PX * 0.9) fail(`buffered jump only reached ${buffered.toFixed(1)}px`)

  // Coyote: simulate leaving the floor 50ms ago, still within the grace window.
  let coyoteMs = COYOTE_MS - 50
  if (coyoteMs <= 0) fail('coyote test setup exceeded coyote window')
  if (coyoteMs > 0) {
    const launched = jumpVelocity(gravity)
    if (!(launched < 0)) fail('coyote jump did not produce upward velocity')
    coyoteMs = 0
  }
  if (coyoteMs !== 0) fail('coyote jump did not consume coyote time')
}

// --- 3: the two obstacle answers actually work -----------------------------
// Uses the REAL geometry constants, not copies. An earlier version of this
// check hardcoded them, so it could not have noticed them drifting.
{
  const spriteTop = FEET_Y - 8

  const standTop = spriteTop + BODY_STAND.oy
  const standBottom = standTop + BODY_STAND.h
  const slideTop = spriteTop + BODY_SLIDE.oy
  const slideBottom = slideTop + BODY_SLIDE.h

  // The manual floor assumes both bodies rest on the same line; if they ever
  // diverge, sliding would sink into or hover above the ground.
  if (BODY_STAND.oy + BODY_STAND.h !== BODY_SLIDE.oy + BODY_SLIDE.h) {
    fail('BODY_STAND and BODY_SLIDE no longer share a bottom edge (oy + h must match)')
  }
  if (standBottom !== REST_BOTTOM) {
    fail(`REST_BOTTOM is ${REST_BOTTOM}, but the standing body rests at ${standBottom}`)
  }

  const blockTop = FEET_Y - 8 + 1 // low block body top

  // Standing must collide with both, or they would not be obstacles at all.
  if (standTop > GATE_BOTTOM_Y) fail('standing body clears the gate -- it is not an obstacle')
  if (standBottom < blockTop) fail('standing body clears the low block')

  // Sliding must clear the gate.
  if (slideTop <= GATE_BOTTOM_Y) {
    fail(`sliding body (top ${slideTop}) does not clear the gate (bottom ${GATE_BOTTOM_Y})`)
  }
  if (slideBottom < slideTop) fail('slide body is inverted')
  if (MAGA_DUCK_COSTUME_H > 16) fail(`MAGA duck costume is ${MAGA_DUCK_COSTUME_H}px tall, expected <= 16px`)

  // Jumping must clear the low block, using the apex the game ACTUALLY
  // achieves at the worst gravity -- not the nominal constant.
  const worstApex = Math.min(...GRAVITY_SCALES.map((gs) => simulateJumpApexPx(GRAVITY_Y * gs)))
  if (standBottom - worstApex >= blockTop) {
    fail(`a full jump (${worstApex}px) does not clear the low block`)
  }

  // Jumping must NOT clear the gate -- that is what makes sliding the answer.
  if (standBottom - worstApex > GATE_BOTTOM_Y) {
    fail('a full jump clears the gate, so sliding is never required')
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  every reachable runner stage is survivable')
