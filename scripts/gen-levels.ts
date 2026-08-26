/**
 * Authoring tool, not a test. Sweeps a large batch of platformer seeds at the
 * Easy difficulty preset, checks each one with the real jump physics
 * (levelCheck.ts / platformerPacing.ts), and writes the gentlest ones out as
 * a curated, committed level pack.
 *
 * This is how new easy levels get made: run this script instead of hand-
 * editing terrain. `npm run validate-levels` is the separate, permanent check
 * that the committed pack -- and the Easy preset in general -- stay solvable
 * as the game keeps changing around them.
 *
 *   npm run gen-levels             regenerate with the defaults below
 *   npm run gen-levels -- --count=20 --sweep=8000
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GRAVITY_Y } from '../src/game/constants.ts'
import { generatePlatformer } from '../src/game/levels/generatePlatformer.ts'
import { checkPlatformerLevel } from '../src/game/levels/levelCheck.ts'
import type { LevelReport } from '../src/game/levels/levelCheck.ts'
import { DIFFICULTY_MODIFIERS } from '../src/game/levels/difficulty.ts'

function flag(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  const n = arg ? Number(arg.slice(name.length + 3)) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const SWEEP = flag('sweep', 4000)
const COUNT = flag('count', 12)

const easy = DIFFICULTY_MODIFIERS.easy
const gravityY = GRAVITY_Y * (easy.gravityScale ?? 1)
const playerSpeedScale = easy.playerSpeedScale ?? 1
const spawnRateScale = easy.spawnRateScale ?? 1

console.log('gen-levels')
console.log(
  `  sweeping ${SWEEP} seeds at the Easy preset ` +
    `(gravityScale=${easy.gravityScale}, playerSpeedScale=${playerSpeedScale}, spawnRateScale=${spawnRateScale})`,
)

interface Candidate {
  readonly seed: number
  readonly report: LevelReport
}

const solved: Candidate[] = []
let rejected = 0

for (let seed = 1; seed <= SWEEP; seed++) {
  const level = generatePlatformer(seed, spawnRateScale, gravityY, playerSpeedScale)
  const report = checkPlatformerLevel(level, gravityY, playerSpeedScale)
  if (report.solvable) {
    solved.push({ seed, report })
  } else {
    rejected++
  }
}

if (solved.length < COUNT) {
  console.error(
    `  FAIL  only ${solved.length}/${SWEEP} seeds were solvable at the Easy preset -- ` +
      `expected at least ${COUNT}. Something in generatePlatformer or the Easy preset changed.`,
  )
  process.exit(1)
}

// Gentlest first: lowest hazard density, fewest pits, shortest hazard runs.
solved.sort((a, b) => a.report.difficultyScore - b.report.difficultyScore)
const chosen = solved.slice(0, COUNT)

console.log(
  `  ${solved.length}/${SWEEP} seeds solvable (${rejected} rejected) -- ` +
    `keeping the gentlest ${chosen.length}`,
)
for (const c of chosen) {
  console.log(
    `    seed ${c.seed}: score ${c.report.difficultyScore.toFixed(1)}, ` +
      `${c.report.pitCount} pits, ${(c.report.hazardDensity * 100).toFixed(1)}% hazard density`,
  )
}

const outPath = fileURLToPath(
  new URL('../src/game/levels/easyPlatformerLevels.ts', import.meta.url),
)

const body = `/**
 * GENERATED FILE -- do not hand-edit. Run \`npm run gen-levels\` to
 * regenerate, which re-sweeps seeds against the CURRENT generator and jump
 * physics and replaces this list. Hand-editing entries here would silently
 * drift from what actually got tested.
 *
 * Every seed below produced a solvable platformer level at the Easy
 * difficulty preset (src/game/levels/difficulty.ts), checked against the
 * real jump physics in levelCheck.ts. scripts/validate-levels.ts re-checks
 * this exact list on every run, so a change to generatePlatformer or to the
 * Easy preset that breaks one of these fails CI rather than failing quietly
 * in someone's playthrough.
 */

export interface EasyLevelEntry {
  readonly seed: number
  /** Lower is gentler. See levelCheck.ts -- a ranking signal, not a proof. */
  readonly difficultyScore: number
}

export const EASY_PLATFORMER_LEVELS: readonly EasyLevelEntry[] = [
${chosen
  .map((c) => `  { seed: ${c.seed}, difficultyScore: ${c.report.difficultyScore.toFixed(2)} },`)
  .join('\n')}
]

/** Draws one of the curated easy seeds. Injectable rng for reproducible
 *  tests; defaults to Math.random for real play. */
export function pickEasyPlatformerSeed(rng: () => number = Math.random): number {
  const i = Math.floor(rng() * EASY_PLATFORMER_LEVELS.length)
  return EASY_PLATFORMER_LEVELS[i].seed
}
`

writeFileSync(outPath, body)
console.log(`  wrote ${chosen.length} levels to src/game/levels/easyPlatformerLevels.ts`)
