/**
 * GENERATED FILE -- do not hand-edit. Run `npm run gen-levels` to
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
  { seed: 3139, difficultyScore: 21.71 },
  { seed: 880, difficultyScore: 23.14 },
  { seed: 2713, difficultyScore: 23.14 },
  { seed: 75, difficultyScore: 23.86 },
  { seed: 1712, difficultyScore: 23.86 },
  { seed: 3866, difficultyScore: 23.86 },
  { seed: 252, difficultyScore: 24.43 },
  { seed: 959, difficultyScore: 24.43 },
  { seed: 3400, difficultyScore: 24.43 },
  { seed: 1035, difficultyScore: 25.86 },
  { seed: 2944, difficultyScore: 25.86 },
  { seed: 3474, difficultyScore: 25.86 },
]

/** Draws one of the curated easy seeds. Injectable rng for reproducible
 *  tests; defaults to Math.random for real play. */
export function pickEasyPlatformerSeed(rng: () => number = Math.random): number {
  const i = Math.floor(rng() * EASY_PLATFORMER_LEVELS.length)
  return EASY_PLATFORMER_LEVELS[i].seed
}
