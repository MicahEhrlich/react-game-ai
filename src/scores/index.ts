import { LocalScoreService } from './LocalScoreService.ts'
import type { ScoreService } from './ScoreService.ts'

export type { ScoreEntry, ScoreService } from './ScoreService.ts'

/** The single instance the UI talks to. Swap this line for the API-backed one. */
export const scores: ScoreService = new LocalScoreService()
