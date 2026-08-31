export interface ScoreEntry {
  readonly name: string
  readonly score: number
  readonly shifts: number
  readonly at: number
}

/**
 * Swappable behind an interface so the future leaderboard API is a new
 * implementation rather than an edit to every caller. Same pattern as
 * TelemetrySink in director/telemetry.ts.
 */
export interface ScoreService {
  top(limit: number): Promise<ScoreEntry[]>
  submit(entry: ScoreEntry): Promise<void>
  qualifies(score: number, limit: number): Promise<boolean>
}
