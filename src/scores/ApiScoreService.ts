import { LocalScoreService } from './LocalScoreService.ts'
import type { ScoreEntry, ScoreService } from './ScoreService.ts'

const ENDPOINT = '/api/scores'

function validEntry(raw: unknown): raw is ScoreEntry {
  if (typeof raw !== 'object' || raw === null) return false
  const r = raw as Record<string, unknown>
  return (
    typeof r.name === 'string' &&
    typeof r.score === 'number' &&
    Number.isFinite(r.score) &&
    typeof r.shifts === 'number' &&
    Number.isFinite(r.shifts) &&
    typeof r.at === 'number' &&
    Number.isFinite(r.at)
  )
}

function entriesFrom(raw: unknown): ScoreEntry[] | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entries = (raw as { entries?: unknown }).entries
  if (!Array.isArray(entries)) return null
  if (!entries.every(validEntry)) return null
  return entries
}

export class ApiScoreService implements ScoreService {
  private readonly local: LocalScoreService

  constructor(local = new LocalScoreService()) {
    this.local = local
  }

  async top(limit: number): Promise<ScoreEntry[]> {
    try {
      const res = await fetch(`${ENDPOINT}?limit=${encodeURIComponent(String(limit))}`, {
        cache: 'no-store',
      })
      if (!res.ok) return this.local.top(limit)
      const type = res.headers.get('content-type') ?? ''
      if (!type.includes('application/json')) return this.local.top(limit)
      const entries = entriesFrom(await res.json())
      if (!entries) return this.local.top(limit)
      this.mirror(entries)
      return entries.slice(0, limit)
    } catch {
      return this.local.top(limit)
    }
  }

  async submit(entry: ScoreEntry): Promise<void> {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entry),
        cache: 'no-store',
      })
      if (res.status === 400 || res.status === 429) return
      if (!res.ok) {
        await this.local.submit(entry)
        return
      }
      const type = res.headers.get('content-type') ?? ''
      if (!type.includes('application/json')) {
        await this.local.submit(entry)
        return
      }
      const entries = entriesFrom(await res.json())
      if (!entries) {
        await this.local.submit(entry)
        return
      }
      this.mirror(entries)
    } catch {
      await this.local.submit(entry)
    }
  }

  async qualifies(score: number, limit: number): Promise<boolean> {
    const entries = await this.top(limit)
    return score > 0 && (entries.length < limit || score > (entries[limit - 1]?.score ?? 0))
  }

  private mirror(entries: readonly ScoreEntry[]): void {
    this.local.replaceSync(entries)
  }
}
