import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiScoreService } from './ApiScoreService.ts'
import { LocalScoreService } from './LocalScoreService.ts'
import type { ScoreEntry } from './ScoreService.ts'

function response(status: number, body: unknown, contentType = 'application/json'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': contentType }),
    json: async () => body,
  } as Response
}

describe('API score service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('uses backend entries and mirrors them locally', async () => {
    const entries: ScoreEntry[] = [{ name: 'AAA', score: 100, shifts: 4, at: 1 }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { entries })))

    const local = new LocalScoreService()
    const api = new ApiScoreService(local)
    await expect(api.top(10)).resolves.toEqual(entries)
    await expect(local.top(10)).resolves.toEqual(entries)
  })

  it('falls back to localStorage when the backend is unavailable', async () => {
    const local = new LocalScoreService()
    await local.submit({ name: 'LOCAL', score: 42, shifts: 2, at: 1 })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const api = new ApiScoreService(local)
    await expect(api.top(10)).resolves.toEqual([{ name: 'LOCAL', score: 42, shifts: 2, at: 1 }])
  })

  it('does not mirror rejected or rate-limited submissions', async () => {
    const local = new LocalScoreService()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(429, {})))

    const api = new ApiScoreService(local)
    await api.submit({ name: 'NOPE', score: 99, shifts: 1, at: 1 })
    await expect(local.top(10)).resolves.toEqual([])
  })
})
