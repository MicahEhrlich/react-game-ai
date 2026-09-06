import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }))
vi.mock('../audio.ts', () => ({ sfx: { shiftWarning: vi.fn(), glitch: vi.fn() }, unlockAudio: vi.fn() }))
vi.mock('../music.ts', () => ({ music: { playForTheme: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn() } }))
vi.mock('../taunts.ts', () => ({ TAUNT: {}, playTaunt: vi.fn(), prefetchTaunt: vi.fn() }))
vi.mock('../art/corruption.ts', () => ({ runCorruption: vi.fn() }))
vi.mock('../touch.ts', () => ({ touch: { releaseAll: vi.fn() } }))
vi.mock('../../director/stageOverrides.ts', () => ({ getOverride: () => null, primeOverrides: vi.fn() }))
vi.mock('../../memeTheme/daily.ts', () => ({ loadDailyMemeTheme: () => Promise.resolve(null) }))
import { ShiftDirectorScene } from './ShiftDirectorScene.ts'
import { LlmDirector } from '../../director/LlmDirector.ts'
import type { DirectorRequest } from '../../director/LlmDirector.ts'
import { gameStore } from '../../state/store.ts'
import { runState } from '../../state/runState.ts'
import { metrics } from '../../state/metrics.ts'
import { PHASE } from '../../state/types.ts'
import { resetPacing, applyPacing } from '../../director/pacing.ts'
import { sfx } from '../audio.ts'

function setup() {
  const requests: { payload: DirectorRequest; signal: AbortSignal; resolve: (v: unknown) => void }[] = []
  const director = new LlmDirector({ request: (payload, signal) => new Promise(resolve => requests.push({ payload, signal, resolve })) })
  director.beginRun('test')
  const scene = new ShiftDirectorScene()
  const internals = scene as unknown as {
    director: LlmDirector; live: LlmDirector; activeKey: string; stageElapsedMs: number
    scene: { get: () => null; stop: () => void; launch: () => void; pause: () => void; resume: () => void }
    time: { now: number; delayedCall: (ms: number, cb: () => void) => void }
    completeShift: () => void; quitToMenu: () => void; endRun: () => void
    pause: () => void; resume: () => void; onCommand: (c: { type: 'FORCE_SHIFT' }) => void
  }
  Object.assign(internals, { director, live: director, activeKey: 'shooter', scene: { get: () => null, stop: vi.fn(), launch: vi.fn(), pause: vi.fn(), resume: vi.fn() }, time: { now: 0, delayedCall: vi.fn() } })
  return { scene, internals, requests, director }
}
beforeEach(() => {
  resetPacing(); metrics.resetRun(); runState.resetRun(0, 'shooter'); gameStore.startRun('shooter'); vi.clearAllMocks()
})
describe('eight-second stage planning', () => {
  it('snapshots A for B, warns without deciding, accepts a late plan, then snapshots B for C', async () => {
    const t = setup()
    metrics.shotFired(); metrics.damaged(5)
    t.scene.update(0, 11999); expect(t.requests).toHaveLength(0)
    t.scene.update(0, 1); expect(t.requests).toHaveLength(1)
    expect(t.requests[0].payload).toMatchObject({ forShiftIndex: 1, metrics: { mode: 'shooter', windowMs: 12000, shotsFired: 1, damageTaken: 5 }, history: { currentMode: 'shooter', shiftIndex: 0 } })
    t.scene.update(0, 5000)
    expect(gameStore.get().shiftWarning).toBe(true)
    expect(gameStore.get().nextMode).toBeNull()
    expect(runState.pendingPlan).toBeNull()
    expect(sfx.shiftWarning).toHaveBeenCalledTimes(1)
    t.scene.update(0, 2000)
    t.requests[0].resolve({ mode: 'platformer', notes: ['5 DAMAGE — MERCY ON'] }); await Promise.resolve()
    t.scene.update(0, 1000)
    expect(gameStore.get().phase).toBe(PHASE.Shifting)
    expect(gameStore.get().nextMode).toBe('platformer')
    expect(t.requests).toHaveLength(1)
    t.internals.completeShift()
    expect(gameStore.get().directorSource).toBe('llm')
    expect(gameStore.get().shiftIndex).toBe(1)
    metrics.jumped()
    t.scene.update(0, runState.stageDurationMs() - 8000)
    expect(t.requests).toHaveLength(2)
    expect(t.requests[1].payload).toMatchObject({ forShiftIndex: 2, metrics: { mode: 'platformer', jumps: 1, shotsFired: 0 }, history: { currentMode: 'platformer', shiftIndex: 1 } })
    t.scene.update(0, 8000)
    expect(gameStore.get().phase).toBe(PHASE.Shifting)
    expect(t.requests[1].signal.aborted).toBe(true)
    t.internals.completeShift()
    expect(gameStore.get().directorSource).toBe('heuristic')
    t.requests[1].resolve(null); await Promise.resolve()
  })
  it('freezes countdown while paused and retains a response received during pause', async () => {
    const t = setup(); t.scene.update(0, 12000); t.internals.pause()
    t.scene.update(0, 10000); expect(t.internals.stageElapsedMs).toBe(12000)
    t.requests[0].resolve({ mode: 'platformer' }); await Promise.resolve()
    t.internals.resume(); t.scene.update(0, 8000)
    expect(gameStore.get().nextMode).toBe('platformer')
  })
  it.each(['short', 'skip'] as const)('requests once when a %s stage enters the window', async (kind) => {
    const t = setup()
    if (kind === 'short') {
      applyPacing({ firstStageSeconds: 5, minStageSeconds: 5 })
      runState.resetRun(0, 'shooter')
    }
    else t.internals.onCommand({ type: 'FORCE_SHIFT' })
    t.scene.update(0, 1); t.scene.update(0, 1)
    expect(t.requests).toHaveLength(1)
    t.internals.quitToMenu(); expect(t.requests[0].signal.aborted).toBe(true)
    t.requests[0].resolve(null); await Promise.resolve()
  })
  it('cancels the stage request on game over', async () => {
    const t = setup(); t.scene.update(0, 12000)
    gameStore.patch({ phase: PHASE.GameOver }); t.internals.endRun()
    expect(t.requests[0].signal.aborted).toBe(true)
    t.director.cancelPending()
    for (const request of t.requests) request.resolve(null)
    await Promise.resolve()
  })
})
