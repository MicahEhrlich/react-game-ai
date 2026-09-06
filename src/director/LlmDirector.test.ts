import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmDirector } from './LlmDirector.ts'
import type { DirectorRequest } from './LlmDirector.ts'
import type { DirectorHistory, RunMetrics } from './types.ts'

const metrics: RunMetrics = { mode: 'shooter', windowMs: 12000, shotsFired: 20, shotsHit: 5, damageTaken: 40, pickups: 0, jumps: 0, avgReactionMs: 500, healthFraction: 0.3, msPerMode: { shooter: 12000, platformer: 0, runner: 0, brick: 0 } }
const history: DirectorHistory = { shiftIndex: 0, currentMode: 'shooter', modeHistory: ['shooter'], chaosLastStage: false }
const plan = { mode: 'platformer', chaos: 'none', notes: ['25 PCT ACCURACY — MERCY ON'] }
function setup() {
  let resolve!: (value: unknown) => void
  let reject!: (reason: unknown) => void
  let signal!: AbortSignal
  const request = vi.fn((_payload: DirectorRequest, s: AbortSignal) => {
    signal = s
    return new Promise<unknown>((yes, no) => { resolve = yes; reject = no })
  })
  const director = new LlmDirector({ request })
  director.beginRun('run')
  director.prime(metrics, history, [])
  return { director, request, resolve, reject, signal }
}
afterEach(() => vi.useRealTimers())
describe('transition deadline', () => {
  it('uses a plan received after seven seconds and preserves repeat reads', async () => {
    vi.useFakeTimers()
    const t = setup()
    await vi.advanceTimersByTimeAsync(7000)
    t.resolve(plan)
    await Promise.resolve()
    const result = t.director.decide(metrics, history)
    expect(result.mode).toBe('platformer')
    expect(t.director.lastSource).toBe('llm')
    expect(t.director.decide(metrics, history)).toBe(result)
    expect(t.request.mock.calls[0][0]).toMatchObject({ forShiftIndex: 1, metrics, history })
  })
  it('seals fallback and ignores a late transport that does not honor abort', async () => {
    const t = setup()
    const result = t.director.decide(metrics, history)
    expect(t.signal.aborted).toBe(true)
    t.resolve(plan)
    await Promise.resolve()
    expect(t.director.decide(metrics, history)).toBe(result)
    expect(t.director.lastSource).toBe('heuristic')
  })
  it.each([null, [], 'invalid'])('uses heuristic for invalid response %s', async (raw) => {
    const t = setup(); t.resolve(raw); await Promise.resolve()
    t.director.decide(metrics, history)
    expect(t.director.lastSource).toBe('heuristic')
  })
  it('uses heuristic for a transport failure, including HTTP 204', async () => {
    const t = setup(); t.reject(new Error('no plan offered')); await Promise.resolve()
    t.director.decide(metrics, history)
    expect(t.director.lastSource).toBe('heuristic')
  })
  it('cancels pending work and isolates a restarted run', async () => {
    const t = setup(); t.director.cancelPending()
    expect(t.signal.aborted).toBe(true)
    t.director.beginRun('new-run'); t.resolve(plan); await Promise.resolve()
    t.director.decide(metrics, history)
    expect(t.director.lastSource).toBe('heuristic')
  })
  it('does not cache a response after the wall-clock timeout', async () => {
    vi.useFakeTimers()
    const t = setup(); await vi.advanceTimersByTimeAsync(20000)
    expect(t.signal.aborted).toBe(true)
    t.resolve(plan); await Promise.resolve()
    t.director.decide(metrics, history)
    expect(t.director.lastSource).toBe('heuristic')
  })
})
