import type { ScoreEntry, ScoreService } from './ScoreService.ts'

const KEY = 'glitch-shift:scores'
const MAX = 10

export class LocalScoreService implements ScoreService {
  top(limit = MAX): ScoreEntry[] {
    return this.readAll().slice(0, limit)
  }

  submit(entry: ScoreEntry): void {
    const next = [...this.readAll(), entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Private browsing / quota exceeded. A lost high score must never take
      // the game down with it.
    }
  }

  qualifies(score: number, limit = MAX): boolean {
    if (score <= 0) return false
    const all = this.readAll()
    return all.length < limit || score > (all[limit - 1]?.score ?? 0)
  }

  private readAll(): ScoreEntry[] {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return (parsed as ScoreEntry[])
        .filter((e) => typeof e?.score === 'number' && typeof e?.name === 'string')
        .sort((a, b) => b.score - a.score)
    } catch {
      return []
    }
  }
}
