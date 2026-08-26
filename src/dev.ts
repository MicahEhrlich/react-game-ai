import type { ModifierDraft } from './director/types.ts'
import type { GameMode } from './state/types.ts'
import { ALL_MODES } from './state/types.ts'

/**
 * Dev-only URL overrides, parsed once at module load. These exist so a
 * transition bug takes seconds to reproduce instead of a minute:
 *
 *   ?mode=shooter                     boot straight into one mode
 *   ?shift=5000                       5s stages instead of 45-75s
 *   ?mods=invertControls,mirrorWorld  force chaos flags on every stage
 *   ?physics=1                        arcade physics debug bodies
 *   ?god=1                            ignore all damage
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
    return { mode: null, shiftMs: null, mods: {}, physics: false, god: false }
  }

  const q = new URLSearchParams(window.location.search)

  const rawMode = q.get('mode')
  const mode = rawMode && isMode(rawMode) ? rawMode : null

  const rawShift = Number(q.get('shift'))
  // Deliberately NOT range-checked against shiftDurationMs's 30-90s clamp:
  // the whole point is to allow the 5s stages the clamp would forbid. If a
  // stage feels far too short, check for this parameter in the URL first.
  const shiftMs = Number.isFinite(rawShift) && rawShift >= 500 ? rawShift : null

  const mods: ModifierDraft = {}
  for (const raw of (q.get('mods') ?? '').split(',')) {
    const [key, value] = raw.split('=')
    if (isChaosKey(key)) {
      mods[key] = true
    } else if (key && value !== undefined && Number.isFinite(Number(value))) {
      // ?mods=spawnRateScale=2 -- still clamped downstream.
      ;(mods as Record<string, number>)[key] = Number(value)
    }
  }

  return {
    mode,
    shiftMs,
    mods,
    physics: q.get('physics') === '1',
    god: q.get('god') === '1',
  }
}

export const DEV = parse()
