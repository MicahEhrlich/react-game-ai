/**
 * Structural check on the Game Director. There is no test framework in this
 * project (nor in react-game, whose validate-levels script this mirrors), so
 * this is a plain node script that fails loudly.
 *
 * What it guards:
 *   1. every plan survives clampModifiers() unchanged -- i.e. the director
 *      cannot emit an out-of-range stage;
 *   2. at most one chaos flag is ever set;
 *   3. a chaos flag never appears two stages running;
 *   4. the next mode is never the current mode.
 *
 * These are exactly the properties a future LLM-backed Director would be far
 * more likely to break than the heuristic is, which is why they are asserted
 * against the interface rather than against the implementation's internals.
 */
import { readFileSync } from 'node:fs'
import { HeuristicDirector } from '../src/director/HeuristicDirector.ts'
import {
  CHAOS_UNLOCK_SHIFT,
  clampModifiers,
  DEFAULT_MODIFIERS,
  hasChaosFlag,
} from '../src/director/modifiers.ts'
import { applyPacing, getPacing, resetPacing } from '../src/director/pacing.ts'
import type { DirectorHistory, RunMetrics, StageModifiers } from '../src/director/types.ts'
import { ALL_MODES, MODE } from '../src/state/types.ts'
import type { GameMode } from '../src/state/types.ts'
import { makeRng } from '../src/game/rng.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

/** Per-mode fixture with every mode present and zero the default, so adding a
 *  mode needs no edit here -- an unplayed mode is always legitimately zero. */
function perMode(over: Partial<Record<GameMode, number>> = {}): Record<GameMode, number> {
  const out = {} as Record<GameMode, number>
  for (const m of ALL_MODES) out[m] = 0
  return { ...out, ...over }
}

function baseMetrics(over: Partial<RunMetrics> = {}): RunMetrics {
  return {
    mode: MODE.Platformer,
    windowMs: 75_000,
    shotsFired: 0,
    shotsHit: 0,
    damageTaken: 0,
    pickups: 0,
    jumps: 0,
    avgReactionMs: 0,
    healthFraction: 1,
    msPerMode: perMode({ [MODE.Platformer]: 75_000 }),
    ...over,
  }
}

/** The three archetypes the director has to behave sanely for. */
const PROFILES: Readonly<Record<string, RunMetrics>> = {
  'perfect player': baseMetrics({ shotsFired: 60, shotsHit: 55, pickups: 30 }),
  'dying player': baseMetrics({
    shotsFired: 40,
    shotsHit: 6,
    damageTaken: 80,
    healthFraction: 0.15,
  }),
  'idle player': baseMetrics({ windowMs: 75_000 }),
  'thrashing player': baseMetrics({ damageTaken: 200, healthFraction: 0.55, jumps: 400 }),
  'degenerate metrics': baseMetrics({
    windowMs: 0,
    shotsFired: 0,
    damageTaken: -5,
    healthFraction: Number.NaN,
  }),
}

function sameModifiers(a: StageModifiers, b: StageModifiers): boolean {
  return (Object.keys(a) as (keyof StageModifiers)[]).every((k) => Object.is(a[k], b[k]))
}

console.log('validate-director')

// --- 1 & 2: every profile, every current mode, many seeds ------------------
for (const [label, metrics] of Object.entries(PROFILES)) {
  for (const currentMode of ALL_MODES) {
    for (let seed = 1; seed <= 200; seed++) {
      const director = new HeuristicDirector(makeRng(seed))
      const history: DirectorHistory = {
        shiftIndex: seed % 9,
        currentMode,
        modeHistory: [currentMode],
        chaosLastStage: seed % 2 === 0,
      }
      const plan = director.decide({ ...metrics, mode: currentMode }, history)

      if (!sameModifiers(plan.modifiers, clampModifiers(plan.modifiers))) {
        fail(`${label}/${currentMode}/seed ${seed}: modifiers outside clamp range`)
      }

      const flags = [
        plan.modifiers.invertControls,
        plan.modifiers.mirrorWorld,
        plan.modifiers.fogOfWar,
      ].filter(Boolean).length
      if (flags > 1) fail(`${label}/${currentMode}/seed ${seed}: ${flags} chaos flags at once`)

      if (history.chaosLastStage && hasChaosFlag(plan.modifiers)) {
        fail(`${label}/${currentMode}/seed ${seed}: chaos flag two stages running`)
      }

      // Chaos stays locked until the player has seen one full sweep of the
      // modes. Asserted against the constant, not a literal 3, so the check
      // tracks the mode count instead of silently weakening when it grows.
      if (history.shiftIndex < CHAOS_UNLOCK_SHIFT && hasChaosFlag(plan.modifiers)) {
        fail(
          `${label}/${currentMode}/seed ${seed}: chaos flag at shift ${history.shiftIndex} (locked until ${CHAOS_UNLOCK_SHIFT})`,
        )
      }

      if (plan.mode === currentMode) {
        fail(`${label}/${currentMode}/seed ${seed}: repeated the current mode`)
      }

      if (plan.notes.length === 0) {
        fail(`${label}/${currentMode}/seed ${seed}: empty director notes`)
      }
    }
  }
}

// --- 3: a long simulated run never wedges on one mode ----------------------
{
  const director = new HeuristicDirector(makeRng(99))
  let currentMode: GameMode = MODE.Platformer
  const modeHistory: GameMode[] = [currentMode]
  let chaosLastStage = false
  const seen = new Set<GameMode>([currentMode])

  for (let shiftIndex = 0; shiftIndex < 40; shiftIndex++) {
    const plan = director.decide(
      baseMetrics({
        mode: currentMode,
        damageTaken: shiftIndex % 3 === 0 ? 0 : 30,
        healthFraction: 0.4 + (shiftIndex % 5) * 0.12,
        msPerMode: perMode({
          [MODE.Platformer]: 60_000,
          [MODE.Shooter]: 40_000,
          [MODE.Runner]: 20_000,
        }),
      }),
      { shiftIndex, currentMode, modeHistory, chaosLastStage },
    )
    if (chaosLastStage && hasChaosFlag(plan.modifiers)) {
      fail(`run sim shift ${shiftIndex}: chaos flag two stages running`)
    }
    if (shiftIndex < CHAOS_UNLOCK_SHIFT && hasChaosFlag(plan.modifiers)) {
      fail(`run sim shift ${shiftIndex}: chaos flag before the shift-${CHAOS_UNLOCK_SHIFT} unlock`)
    }
    chaosLastStage = hasChaosFlag(plan.modifiers)
    currentMode = plan.mode
    modeHistory.push(currentMode)
    seen.add(currentMode)
  }

  if (seen.size !== ALL_MODES.length) {
    fail(`run sim visited only ${seen.size}/${ALL_MODES.length} modes in 40 shifts`)
  }
}

// --- 4: clampModifiers is total, even on hostile input --------------------
{
  const hostile = clampModifiers({
    gravityScale: Number.POSITIVE_INFINITY,
    playerSpeedScale: -100,
    spawnRateScale: Number.NaN,
    scoreMultiplier: 9999,
    shiftDurationMs: 1,
    invertControls: true,
    mirrorWorld: true,
    fogOfWar: true,
  })
  if (!sameModifiers(hostile, clampModifiers(hostile))) {
    fail('clampModifiers is not idempotent on hostile input')
  }
  const flags = [hostile.invertControls, hostile.mirrorWorld, hostile.fogOfWar].filter(Boolean)
  if (flags.length !== 1) {
    fail(`clampModifiers let ${flags.length} chaos flags through (expected exactly 1)`)
  }
  // Bounds come from getPacing(), not copied literals -- a hardcoded 30_000/
  // 90_000 here would have quietly stopped meaning anything the moment
  // pacing.json's bounds changed, since clampModifiers clamps against the
  // LIVE pacing config, not a fixed range.
  const { minStageMs, maxStageMs } = getPacing()
  if (hostile.shiftDurationMs < minStageMs) {
    fail(`clampModifiers let a sub-${minStageMs / 1000}s stage through`)
  }
  if (hostile.shiftDurationMs > maxStageMs) {
    fail(`clampModifiers let an over-${maxStageMs / 1000}s stage through`)
  }
}

// --- 5: stage pacing ------------------------------------------------------
// The product requirement, as an assertion: an opening stage around 20s, a
// mean around 20s, and NOTHING over 30s -- stages were deliberately shortened
// from the original 45-90s range so the game feels faster. Tuning drifts;
// this is what stops it drifting past what the game is supposed to feel like.
{
  const MEAN_CEILING_MS = 25_000
  const HARD_CEILING_MS = 30_000

  // Independent literal, NOT derived from getPacing() -- check 4 already
  // confirms clampModifiers respects whatever maxStageMs currently says, but
  // that check is circular with respect to the NUMBER itself: it would pass
  // just as happily if maxStageSeconds were bumped back to 90 in pacing.json
  // or DEFAULT_PACING, as long as clampModifiers kept obeying it. This is the
  // one place the literal "no stage over 30s" requirement is asserted against
  // the actual config value, not against itself. (Confirmed by mutation
  // testing: reverting maxStageMs alone, with baseStageMs left at 30s, passed
  // every other check in this file -- the director's own requests never
  // approached the loosened ceiling, so nothing else would have caught it.)
  if (getPacing().maxStageMs > HARD_CEILING_MS) {
    fail(
      `configured maxStageMs (${getPacing().maxStageMs / 1000}s) exceeds the ` +
        `${HARD_CEILING_MS / 1000}s product requirement`,
    )
  }

  if (DEFAULT_MODIFIERS.shiftDurationMs > 20_000) {
    fail(
      `opening stage is ${DEFAULT_MODIFIERS.shiftDurationMs / 1000}s, expected 20s or less`,
    )
  }

  const director = new HeuristicDirector(makeRng(5))
  let currentMode: GameMode = MODE.Platformer
  const modeHistory: GameMode[] = [currentMode]
  // The opening stage counts toward the average the player actually feels.
  const durations: number[] = [DEFAULT_MODIFIERS.shiftDurationMs]

  for (let shiftIndex = 0; shiftIndex < 12; shiftIndex++) {
    const plan = director.decide(baseMetrics({ mode: currentMode }), {
      shiftIndex,
      currentMode,
      modeHistory,
      chaosLastStage: false,
    })
    durations.push(plan.modifiers.shiftDurationMs)
    currentMode = plan.mode
    modeHistory.push(currentMode)
  }

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length
  const max = Math.max(...durations)

  if (mean > MEAN_CEILING_MS) {
    fail(`mean stage ${(mean / 1000).toFixed(1)}s exceeds the ${MEAN_CEILING_MS / 1000}s target`)
  }
  if (max > HARD_CEILING_MS) {
    fail(`longest stage ${(max / 1000).toFixed(1)}s exceeds the ${HARD_CEILING_MS / 1000}s ceiling`)
  }
}

// --- 6: the pacing config is hand-edited, so treat it as hostile input -----
// public/config/pacing.json is meant to be tuned by hand. A typo in it must
// degrade to something playable, never break the game or escape the clamp.
{
  const cases: Array<[string, unknown]> = [
    ['null', null],
    ['not an object', 42],
    ['empty', {}],
    ['negative', { firstStageSeconds: -10, minStageSeconds: -5, maxStageSeconds: -1 }],
    ['NaN-ish', { firstStageSeconds: 'forty', taperShifts: 1.5 }],
    ['absurd', { firstStageSeconds: 1e9, maxStageSeconds: 1e9, taperPerShiftSeconds: 1e9 }],
    ['inverted bounds', { minStageSeconds: 90, maxStageSeconds: 10 }],
    ['zero taper', { taperPerShiftSeconds: 0, taperShifts: 0 }],
  ]

  for (const [label, payload] of cases) {
    const p = applyPacing(payload)

    const finite = Object.values(p).every((v) => Number.isFinite(v))
    if (!finite) fail(`pacing "${label}": produced a non-finite value`)
    if (p.minStageMs > p.maxStageMs) {
      fail(`pacing "${label}": min ${p.minStageMs} exceeds max ${p.maxStageMs}`)
    }
    if (p.firstStageMs < p.minStageMs || p.firstStageMs > p.maxStageMs) {
      fail(`pacing "${label}": first stage ${p.firstStageMs} outside its own bounds`)
    }
    if (p.taperShifts < 0 || !Number.isInteger(p.taperShifts)) {
      fail(`pacing "${label}": taperShifts ${p.taperShifts} is not a non-negative integer`)
    }

    // And the clamp must still hold the line against whatever was installed.
    const stage = clampModifiers({ shiftDurationMs: 1 }).shiftDurationMs
    if (stage < p.minStageMs || stage > p.maxStageMs) {
      fail(`pacing "${label}": clampModifiers produced ${stage}, outside [${p.minStageMs}, ${p.maxStageMs}]`)
    }
  }

  resetPacing()
}

// --- 7: the COMMITTED public/config/pacing.json meets the product
//        requirement, not just DEFAULT_PACING ------------------------------
// Checks 4-6 exercise DEFAULT_PACING (the TS-level fallback) and synthetic
// hostile payloads -- neither one ever reads the actual file the README and
// CLAUDE.md tell you to hand-edit. applyPacing()'s own bounds only reject
// truly broken input (negative, non-finite, outside 5s-600s); a well-formed
// but too-generous value like maxStageSeconds: 60 would sail through
// unclamped by applyPacing itself. This is the one check that would catch
// someone loosening the actual shipped file.
{
  const raw: unknown = JSON.parse(
    readFileSync(new URL('../public/config/pacing.json', import.meta.url), 'utf8'),
  )
  const committed = applyPacing(raw)
  const PRODUCT_MAX_MS = 30_000

  if (committed.maxStageMs > PRODUCT_MAX_MS) {
    fail(
      `public/config/pacing.json's maxStageSeconds (${committed.maxStageMs / 1000}s) exceeds ` +
        `the ${PRODUCT_MAX_MS / 1000}s product requirement`,
    )
  }
  if (committed.firstStageMs > PRODUCT_MAX_MS) {
    fail(
      `public/config/pacing.json's firstStageSeconds (${committed.firstStageMs / 1000}s) exceeds ` +
        `the ${PRODUCT_MAX_MS / 1000}s product requirement`,
    )
  }

  resetPacing()
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  all director invariants hold')
