import { ApiScoreService } from './ApiScoreService.ts'
import type { ScoreService } from './ScoreService.ts'

export type { ScoreEntry, ScoreService } from './ScoreService.ts'

/** The single instance the UI talks to. Falls back to localStorage offline. */
export const scores: ScoreService = new ApiScoreService()
