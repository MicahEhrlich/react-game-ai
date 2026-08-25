import type { GameMode } from '../state/types.ts'
import type { StageModifiers } from './types.ts'

/**
 * Run analytics. Mirrors the ScoreService/LocalScoreService split in
 * react-game: an interface plus a localStorage implementation now, with an
 * HttpTelemetrySink against the future Node/Express API as a drop-in later.
 * Nothing in the game imports the implementation directly.
 */
export interface StageRecord {
  readonly shiftIndex: number
  readonly mode: GameMode
  readonly durationMs: number
  readonly scoreAtEnd: number
  readonly healthAtEnd: number
  readonly damageTaken: number
  readonly shotsFired: number
  readonly shotsHit: number
  readonly modifiers: StageModifiers
  readonly directorNotes: readonly string[]
}

export interface RunRecord {
  readonly runId: string
  readonly startedAt: number
  readonly endedAt: number
  readonly finalScore: number
  readonly shifts: number
  readonly stages: readonly StageRecord[]
}

export interface TelemetrySink {
  stageCompleted(record: StageRecord): void
  runCompleted(record: RunRecord): void
  recentRuns(limit: number): RunRecord[]
}

const KEY = 'glitch-shift:telemetry'
const MAX_RUNS = 20

export class LocalTelemetrySink implements TelemetrySink {
  private stages: StageRecord[] = []

  stageCompleted(record: StageRecord): void {
    this.stages.push(record)
  }

  runCompleted(record: RunRecord): void {
    const full: RunRecord = { ...record, stages: this.stages }
    this.stages = []
    try {
      const runs = [full, ...this.recentRuns(MAX_RUNS)].slice(0, MAX_RUNS)
      localStorage.setItem(KEY, JSON.stringify(runs))
    } catch {
      // Private-browsing / quota. Telemetry is never worth breaking a run over.
    }
  }

  recentRuns(limit: number): RunRecord[] {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as RunRecord[]).slice(0, limit) : []
    } catch {
      return []
    }
  }
}

export const telemetry: TelemetrySink = new LocalTelemetrySink()

export function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
