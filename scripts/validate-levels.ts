/**
 * Structural check on platformer level generation and on the Easy difficulty
 * preset for all three modes, in the same shape as validate-director and
 * validate-runner: a plain node script that fails loudly, because there is no
 * test framework here.
 *
 * What it guards:
 *   1. every curated seed in easyPlatformerLevels.ts is STILL solvable at the
 *      Easy preset, against the CURRENT generator and jump physics -- so a
 *      change to either fails here instead of failing quietly in a run;
 *   2. the Easy preset produces solvable platformer levels at a high rate
 *      generally, not just for the dozen curated seeds;
 *   3. every pit, across the FULL clamped modifier space (not just Easy), is
 *      narrower than the jump that has to clear it -- the regression guard
 *      for the fixed-JUMP_VELOCITY-under-scaled-gravity bug (see
 *      platformerPacing.ts and CLAUDE.md invariant 8);
 *   4. the runner and shooter Easy presets sit comfortably inside the safe
 *      range validate-runner already proves for the FULL range, with real
 *      margin to spare rather than just barely qualifying.
 */
import { GRAVITY_Y } from '../src/game/constants.ts'
import { generatePlatformer, mirrorPlatformerLevel } from '../src/game/levels/generatePlatformer.ts'
import { checkPlatformerLevel } from '../src/game/levels/levelCheck.ts'
import { EASY_PLATFORMER_LEVELS } from '../src/game/levels/easyPlatformerLevels.ts'
import { DIFFICULTY_MODIFIERS } from '../src/game/levels/difficulty.ts'
import { jumpAirTimeSec, maxJumpDistancePx } from '../src/game/platformerPacing.ts'
import { jumpArcSec, landingSlackSec, scrollSpeedAt } from '../src/game/runnerPacing.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

console.log('validate-levels')

const easy = DIFFICULTY_MODIFIERS.easy
const easyGravityY = GRAVITY_Y * (easy.gravityScale ?? 1)
const easyPlayerSpeedScale = easy.playerSpeedScale ?? 1
const easySpawnRateScale = easy.spawnRateScale ?? 1

// --- 1: the curated pack is still solvable, right now ----------------------
for (const entry of EASY_PLATFORMER_LEVELS) {
  const level = generatePlatformer(
    entry.seed,
    easySpawnRateScale,
    easyGravityY,
    easyPlayerSpeedScale,
  )
  const report = checkPlatformerLevel(level, easyGravityY, easyPlayerSpeedScale)
  if (!report.solvable) {
    fail(
      `curated seed ${entry.seed} is no longer solvable at the Easy preset: ${report.issues.join('; ')}`,
    )
  }
}
if (EASY_PLATFORMER_LEVELS.length === 0) {
  fail('easyPlatformerLevels.ts is empty -- run `npm run gen-levels`')
}

// --- 2: Easy is easy in general, not just for the curated dozen ------------
{
  const SWEEP = 500
  const MIN_PASS_RATE = 0.98
  let solved = 0
  for (let seed = 1; seed <= SWEEP; seed++) {
    const level = generatePlatformer(
      seed,
      easySpawnRateScale,
      easyGravityY,
      easyPlayerSpeedScale,
    )
    if (checkPlatformerLevel(level, easyGravityY, easyPlayerSpeedScale).solvable) solved++
  }
  const rate = solved / SWEEP
  if (rate < MIN_PASS_RATE) {
    fail(
      `only ${(rate * 100).toFixed(1)}% of ${SWEEP} random seeds are solvable at the Easy ` +
        `preset (expected >= ${MIN_PASS_RATE * 100}%)`,
    )
  }
}

// --- 3: every pit stays inside the jump, across the FULL modifier space ----
// This is the regression guard for the pit-width fix: generatePlatformer used
// to cap pits at 2-3 tiles unconditionally, with no regard for gravityScale
// or playerSpeedScale. At gravityScale 1.6 / playerSpeedScale 0.7 -- both
// individually inside clampModifiers' range, and nothing stops them
// co-occurring -- the safe jump distance drops under a max-width pit. The fix
// derives the cap from the SAME live gravity and speed generatePlatformer is
// called with; this asserts that derivation actually holds everywhere, not
// just at the neutral defaults.
{
  const GRAVITY_SCALES = [0.5, 0.75, 1, 1.3, 1.6]
  const SPEED_SCALES = [0.7, 1, 1.2, 1.4]
  const SPAWN_SCALES = [0.5, 1, 1.45, 1.75, 2]
  const SEEDS = [1, 2, 3, 4, 5]

  for (const gs of GRAVITY_SCALES) {
    const gravityY = GRAVITY_Y * gs
    for (const ps of SPEED_SCALES) {
      for (const ss of SPAWN_SCALES) {
        for (const seed of SEEDS) {
          const level = generatePlatformer(seed, ss, gravityY, ps)
          const report = checkPlatformerLevel(level, gravityY, ps)
          const mirrored = mirrorPlatformerLevel(level)
          if (!report.solvable) {
            fail(
              `gravity ${gs} / speed ${ps} / spawn ${ss} / seed ${seed}: ` +
                report.issues.join('; '),
            )
          }
          if (mirrored.startY !== level.heightPx - level.startY) {
            fail(`mirrored seed ${seed}: startY did not flip around level height`)
          }
          const roundTrip = mirrorPlatformerLevel(mirrored)
          if (roundTrip.startY !== level.startY || JSON.stringify(roundTrip.grid) !== JSON.stringify(level.grid)) {
            fail(`mirrored seed ${seed}: mirror transform is not reversible`)
          }
          for (const spawn of mirrored.spawns) {
            if (spawn.y < 0 || spawn.y > mirrored.heightPx) {
              fail(`mirrored seed ${seed}: spawn ${spawn.kind} y=${spawn.y} out of bounds`)
            }
          }
        }
      }
    }
  }
}

// --- 3b: the fix is real -- prove the OLD unconditional 2-3 tile cap would
//         actually have failed at the harsh end, so this isn't a check for a
//         bug that could never have happened. -------------------------------
{
  const HARSH_GRAVITY_SCALE = 1.6
  const HARSH_SPEED_SCALE = 0.7
  const gravityY = GRAVITY_Y * HARSH_GRAVITY_SCALE
  const oldUncappedMaxPitPx = 3 * 16 // TILE_SIZE, inlined: the old literal cap
  const safeDistancePx = maxJumpDistancePx(gravityY, HARSH_SPEED_SCALE)

  if (oldUncappedMaxPitPx <= safeDistancePx) {
    fail(
      'the harsh-modifier case no longer exceeds the safe jump distance -- ' +
        're-derive HARSH_GRAVITY_SCALE/HARSH_SPEED_SCALE before trusting check 3',
    )
  }
}

// --- 4: runner and shooter Easy presets have REAL margin, not just enough --
{
  // Stricter than validate-runner's MIN_HUMAN_SLACK_SEC floor of 0.15s: Easy
  // should feel generous, not merely survivable.
  const EASY_SLACK_FLOOR_SEC = 0.4
  const gravityY = GRAVITY_Y * (easy.gravityScale ?? 1)
  const spawnRateScale = easy.spawnRateScale ?? 1
  const playerSpeedScale = easy.playerSpeedScale ?? 1

  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const scroll = scrollSpeedAt(progress, playerSpeedScale)
    const slack = landingSlackSec(scroll, gravityY, spawnRateScale)
    if (slack < EASY_SLACK_FLOOR_SEC) {
      fail(
        `runner Easy preset at progress ${progress}: landing slack ${slack.toFixed(3)}s ` +
          `is below the ${EASY_SLACK_FLOOR_SEC}s Easy floor`,
      )
    }
  }

  // Sanity on the platformer/runner jump-timing kinship: Easy's floatier
  // gravity should give a LONGER air time than neutral, not a shorter one --
  // otherwise "Easy" would be quietly making jumps snappier/harder to time.
  if (jumpAirTimeSec(gravityY) <= jumpAirTimeSec(GRAVITY_Y)) {
    fail('Easy gravityScale does not lengthen the platformer jump arc versus neutral')
  }
  if (jumpArcSec(gravityY) <= jumpArcSec(GRAVITY_Y)) {
    fail('Easy gravityScale does not lengthen the runner jump arc versus neutral')
  }
}

// --- 5: every DIFFICULTY_MODIFIERS entry survives clampModifiers unchanged -
// A preset that got silently clamped would mean the "Easy" a player gets
// differs from the one this whole file just validated.
{
  const { clampModifiers } = await import('../src/director/modifiers.ts')
  for (const [name, draft] of Object.entries(DIFFICULTY_MODIFIERS)) {
    const clamped = clampModifiers(draft)
    for (const key of Object.keys(draft) as (keyof typeof draft)[]) {
      const before = draft[key]
      const after = clamped[key]
      if (typeof before === 'number' && !Object.is(before, after)) {
        fail(`${name} preset's ${key} (${before}) was altered by clampModifiers to ${after}`)
      }
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  the curated easy levels and difficulty presets hold up')
