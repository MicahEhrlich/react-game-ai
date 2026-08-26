import type { ModifierDraft } from './director/types.ts'
import { DIFFICULTY_MODIFIERS, isLevelDifficulty } from './game/levels/difficulty.ts'
import type { LevelDifficulty } from './game/levels/difficulty.ts'
import type { GameMode } from './state/types.ts'
import { ALL_MODES } from './state/types.ts'

/**
 * Dev-only URL overrides, parsed once at module load. These exist so a
 * transition bug takes seconds to reproduce instead of a minute:
 *
 *   ?mode=shooter                     boot straight into one mode
 *   ?shift=5000                       5s stages instead of 18-30s
 *   ?mods=invertControls,mirrorWorld  force chaos flags on every stage
 *   ?physics=1                        arcade physics debug bodies
 *   ?god=1                            ignore all damage
 *   ?ai=0                             force the heuristic director
 *   ?ai=1                             force the live director on
 *   ?difficulty=easy                  apply the Easy modifier preset, and
 *                                     have the platformer pick from the
 *                                     curated easy level pack instead of a
 *                                     fully random seed
 *   ?difficulty=hard                  apply the Hard modifier preset
 *
 * ?difficulty= merges its preset into mods FIRST, so an explicit ?mods= key
 * still wins on top of it -- e.g. ?difficulty=easy&mods=spawnRateScale=2
 * gives an easy shell with one field poked.
 */
const CHAOS_KEYS = ['invertControls', 'mirrorWorld', 'fogOfWar'] as const
type ChaosKey = (typeof CHAOS_KEYS)[number]

function isChaosKey(s: string): s is ChaosKey {
  return (CHAOS_KEYS as readonly string[]).includes(s)
}

function isMode(s: string): s is GameMode {
  return (ALL_MODES as readonly string[]).includes(s)
}

function parse() {
  // The window check comes FIRST so this short-circuits under plain Node,
  // where `import.meta.env` does not exist at all -- that is what lets the
  // validate-* scripts import modules that reach dev.ts.
  //
  // `import.meta.env.DEV` is statically false in a production build, so the
  // condition still collapses to `true` there and every override below is
  // tree-shaken out.
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return {
      mode: null,
      shiftMs: null,
      mods: {},
      physics: false,
      god: false,
      ai: null,
      difficulty: null,
    }
  }

  const q = new URLSearchParams(window.location.search)

  const rawMode = q.get('mode')
  const mode = rawMode && isMode(rawMode) ? rawMode : null

  const rawShift = Number(q.get('shift'))
  // Deliberately NOT range-checked against shiftDurationMs's 18-30s clamp:
  // the whole point is to allow the 5s stages the clamp would forbid. If a
  // stage feels far too short, check for this parameter in the URL first.
  const shiftMs = Number.isFinite(rawShift) && rawShift >= 500 ? rawShift : null

  const rawDifficulty = q.get('difficulty')
  const difficulty: LevelDifficulty | null =
    rawDifficulty && isLevelDifficulty(rawDifficulty) ? rawDifficulty : null

  // The preset first, so an explicit ?mods= key parsed below still wins.
  const mods: ModifierDraft = difficulty ? { ...DIFFICULTY_MODIFIERS[difficulty] } : {}
  for (const raw of (q.get('mods') ?? '').split(',')) {
    const [key, value] = raw.split('=')
    if (isChaosKey(key)) {
      mods[key] = true
    } else if (key && value !== undefined && Number.isFinite(Number(value))) {
      // ?mods=spawnRateScale=2 -- still clamped downstream.
      ;(mods as Record<string, number>)[key] = Number(value)
    }
  }

  // Tri-state: null means "whatever the build defaults to", so ?ai=0 can turn
  // the live director off in dev without ?ai=1 being needed to keep it on.
  const rawAi = q.get('ai')
  const ai = rawAi === '1' ? true : rawAi === '0' ? false : null

  return {
    mode,
    shiftMs,
    mods,
    physics: q.get('physics') === '1',
    god: q.get('god') === '1',
    ai,
    difficulty,
  }
}

export const DEV = parse()
