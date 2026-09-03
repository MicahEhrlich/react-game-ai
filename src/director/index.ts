import { readAiModeEnabled } from '../game/aiSettings.ts'
import { HeuristicDirector } from './HeuristicDirector.ts'
import { HttpDirectorTransport } from './httpTransport.ts'
import { LlmDirector } from './LlmDirector.ts'
import type { Director } from './types.ts'

/**
 * The one place that decides whether the live director is in play.
 *
 * It exists for two reasons. First, ShiftDirectorScene should not know which
 * concrete director it got -- it holds a `Director` and asks isLiveDirector()
 * about the rest. Second, this module is the only importer of httpTransport,
 * which touches fetch and import.meta.env; keeping that edge here is what lets
 * scripts/validate-llm-director.ts import LlmDirector under a tsconfig with no
 * DOM lib.
 *
 * Default: on in dev, off in a production build -- a static bundle has no
 * /api/director to talk to. `?ai=1` forces it on, `?ai=0` off.
 */
export function makeDirector(aiModeEnabled = readAiModeEnabled()): Director {
  const heuristic = new HeuristicDirector(Math.random, { automaticChaos: aiModeEnabled })
  if (!aiModeEnabled) return heuristic

  return new LlmDirector(new HttpDirectorTransport(), heuristic, Math.random, (msg) => {
    if (import.meta.env.DEV) console.info(`[director] ${msg}`)
  })
}
