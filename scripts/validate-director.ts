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
import { HeuristicDirector } from '../src/director/HeuristicDirector.ts'
import { clampModifiers, hasChaosFlag } from '../src/director/modifiers.ts'
import type { DirectorHistory, RunMetrics, StageModifiers } from '../src/director/types.ts'
import { ALL_MODES, MODE } from '../src/state/types.ts'
import type { GameMode } from '../src/state/types.ts'
import { makeRng } from '../src/game/rng.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
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
    msPerMode: { [MODE.Platformer]: 75_000, [MODE.Shooter]: 0, [MODE.Runner]: 0 },
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
        msPerMode: {
          [MODE.Platformer]: 60_000,
          [MODE.Shooter]: 40_000,
          [MODE.Runner]: 20_000,
        },
      }),
      { shiftIndex, currentMode, modeHistory, chaosLastStage },
    )
    if (chaosLastStage && hasChaosFlag(plan.modifiers)) {
      fail(`run sim shift ${shiftIndex}: chaos flag two stages running`)
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
  if (hostile.shiftDurationMs < 60_000) fail('clampModifiers let a sub-60s stage through')
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  all director invariants hold')
