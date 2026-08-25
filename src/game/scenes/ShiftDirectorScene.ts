import Phaser from 'phaser'
import { DEV } from '../../dev.ts'
import { HeuristicDirector } from '../../director/HeuristicDirector.ts'
import { clampModifiers } from '../../director/modifiers.ts'
import { getOverride, primeOverrides } from '../../director/stageOverrides.ts'
import { newRunId, telemetry } from '../../director/telemetry.ts'
import type { Director, StagePlan } from '../../director/types.ts'
import { metrics } from '../../state/metrics.ts'
import { commands } from '../../state/commands.ts'
import { runState } from '../../state/runState.ts'
import { gameStore } from '../../state/store.ts'
import type { GameCommand, GameMode } from '../../state/types.ts'
import { PHASE } from '../../state/types.ts'
import { sfx, unlockAudio } from '../audio.ts'
import { runCorruption } from '../art/corruption.ts'
import { GLITCH_DURATION_MS, SCORE_SURVIVE_SHIFT, SHIFT_WARNING_MS } from '../constants.ts'
import { TAUNT, playTaunt, prefetchTaunt } from '../taunts.ts'
import { touch } from '../touch.ts'
import { SCENE, SCENE_FOR_MODE } from './keys.ts'
import type { SceneKey } from './keys.ts'

/**
 * The Glitch Engine. A headless scene, launched in parallel by BootScene and
 * never stopped, that is the single owner of:
 *
 *   - the shift countdown,
 *   - which mode scene is running,
 *   - pause/resume, quit, and end-of-run teardown.
 *
 * Mode scenes know nothing about shifting; they are started and stopped
 * around them. Keeping all of it here is what stops three scenes from each
 * growing their own half-correct copy of the transition.
 *
 * The clock accumulates `delta` rather than reading the global timestamp,
 * which is what makes pausing free: a paused scene's update() is never
 * called, so the countdown simply stops advancing.
 */
export class ShiftDirectorScene extends Phaser.Scene {
  private director: Director = new HeuristicDirector()
  private activeKey: SceneKey | null = null
  private stageElapsedMs = 0
  private planned = false
  private shifting = false
  private runId = ''
  private runStartedAt = 0
  private unsubscribeCommands: (() => void) | null = null
  private unsubscribeStore: (() => void) | null = null

  constructor() {
    super(SCENE.ShiftDirector)
  }

  create(): void {
    // This scene is never stopped, so create() runs once per Phaser.Game --
    // but StrictMode builds two Games in dev, so resetting is still correct.
    this.director = new HeuristicDirector()
    this.activeKey = null
    this.stageElapsedMs = 0
    this.planned = false
    this.shifting = false
    this.runId = ''
    this.runStartedAt = 0

    this.unsubscribeCommands = commands.on((c) => this.onCommand(c))

    // Phaser -> React is gameStore; React -> Phaser is commands. Game over is
    // raised inside gameStore.damage(), so the orchestrator learns about it
    // by watching the store rather than by adding a third channel.
    this.unsubscribeStore = gameStore.subscribe(() => this.onStoreChange())

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeCommands?.()
      this.unsubscribeStore?.()
      this.unsubscribeCommands = null
      this.unsubscribeStore = null
    })
  }

  update(_time: number, delta: number): void {
    if (gameStore.get().phase !== PHASE.Playing) return
    if (!this.activeKey || this.shifting) return

    this.stageElapsedMs += delta
    const remaining = runState.stageDurationMs() - this.stageElapsedMs

    // Quantised to whole seconds before it touches the store: patch() no-ops
    // when unchanged, so the countdown costs one re-render per second rather
    // than one per frame.
    gameStore.patch({ secondsToShift: Math.max(0, Math.ceil(remaining / 1000)) })

    if (!this.planned && remaining <= SHIFT_WARNING_MS) this.planNextStage()
    if (remaining <= 0) this.beginShift()
  }

  // --- commands ---------------------------------------------------------

  private onCommand(c: GameCommand): void {
    switch (c.type) {
      case 'START_RUN':
        this.startRun()
        break
      case 'PAUSE':
        this.pause()
        break
      case 'RESUME':
        this.resume()
        break
      case 'QUIT_TO_MENU':
        this.quitToMenu()
        break
      case 'FORCE_SHIFT':
        // Skip straight to the warning window; the normal path takes over.
        if (this.activeKey && !this.shifting) {
          this.stageElapsedMs = runState.stageDurationMs() - SHIFT_WARNING_MS
        }
        break
    }
  }

  private startRun(): void {
    unlockAudio()
    for (const id of [TAUNT.Shift, TAUNT.Hurt, TAUNT.Streak, TAUNT.GameOver]) {
      prefetchTaunt(id)
    }
    void primeOverrides()

    metrics.resetRun()
    runState.resetRun(this.time.now)
    gameStore.startRun()

    this.runId = newRunId()
    this.runStartedAt = Date.now()
    this.stageElapsedMs = 0
    this.planned = false
    this.shifting = false

    const mode = gameStore.get().mode
    this.activeKey = SCENE_FOR_MODE[mode]
    // launch(), never start(): ScenePlugin.start queues a stop on the CALLING
    // scene, so starting a mode from here would shut the director down and
    // silently freeze the shift clock along with it.
    this.scene.launch(this.activeKey)
  }

  private pause(): void {
    if (gameStore.get().phase !== PHASE.Playing || !this.activeKey) return
    gameStore.patch({ phase: PHASE.Paused })
    this.scene.pause(this.activeKey)
    touch.releaseAll()
  }

  private resume(): void {
    if (gameStore.get().phase !== PHASE.Paused || !this.activeKey) return
    this.scene.resume(this.activeKey)
    gameStore.patch({ phase: PHASE.Playing })
  }

  private quitToMenu(): void {
    this.stopActive()
    touch.releaseAll()
    gameStore.toMenu()
  }

  // --- the shift --------------------------------------------------------

  /**
   * Runs SHIFT_WARNING_MS before the swap so the plan is ready and waiting.
   * Everything here is synchronous; the only network-backed input
   * (getOverride) reads a payload primed at the start of the run.
   */
  private planNextStage(): void {
    this.planned = true

    const s = gameStore.get()
    const snapshot = metrics.snapshot(
      s.mode,
      this.stageElapsedMs,
      s.maxHealth > 0 ? s.health / s.maxHealth : 0,
    )

    let plan = this.director.decide(snapshot, {
      shiftIndex: s.shiftIndex,
      currentMode: s.mode,
      modeHistory: runState.modeHistory,
      chaosLastStage: runState.chaosLastStage,
    })

    plan = this.applyOverrides(plan, s.shiftIndex + 1)

    runState.setPendingPlan(plan)
    gameStore.patch({ shiftWarning: true, nextMode: plan.mode })
    sfx.shiftWarning()
  }

  /**
   * Server payload first, then the ?mods= dev override, then the clamp. The
   * clamp is last on purpose: nothing that reaches a scene has skipped it.
   */
  private applyOverrides(plan: StagePlan, shiftIndex: number): StagePlan {
    const notes = [...plan.notes]
    let modifiers = plan.modifiers

    const server = getOverride(plan.mode, shiftIndex)
    if (server) {
      modifiers = { ...modifiers, ...server }
      notes.push('DIRECTIVE RECEIVED')
    }
    if (import.meta.env.DEV && Object.keys(DEV.mods).length > 0) {
      modifiers = { ...modifiers, ...DEV.mods }
      notes.push('DEV OVERRIDE')
    }

    return { ...plan, modifiers: clampModifiers(modifiers), notes }
  }

  private beginShift(): void {
    this.shifting = true

    // Surviving a full stage is the biggest single score event in the game --
    // it is what makes the countdown a goal rather than a threat.
    const s = gameStore.get()
    gameStore.addScore(Math.round(SCORE_SURVIVE_SHIFT * s.multiplier))

    // Surface the INCOMING stage's notes now, not after the swap -- the
    // overlay is the only place the player sees why the game just changed.
    gameStore.patch({
      phase: PHASE.Shifting,
      secondsToShift: 0,
      nextMode: runState.pendingPlan?.mode ?? null,
      lastDirectorNotes: runState.pendingPlan?.notes ?? [],
    })
    sfx.glitch()
    playTaunt(TAUNT.Shift, 0.55)
    touch.releaseAll()

    if (this.activeKey) {
      const active = this.scene.get(this.activeKey)
      if (active) runCorruption(active, GLITCH_DURATION_MS)
    }

    this.time.delayedCall(GLITCH_DURATION_MS, () => this.completeShift())
  }

  private completeShift(): void {
    // The run may have ended during the transition.
    if (gameStore.get().phase !== PHASE.Shifting) {
      this.shifting = false
      return
    }

    // planNextStage() always runs first, but a plan is cheap to recompute and
    // arriving at the swap without one must never be fatal.
    const plan = runState.pendingPlan ?? this.fallbackPlan()

    this.recordStage(plan)

    const previousKey = this.activeKey
    runState.commitPlan(plan, this.time.now)
    metrics.rollShift()

    if (previousKey) this.scene.stop(previousKey)
    this.activeKey = SCENE_FOR_MODE[plan.mode]
    this.scene.launch(this.activeKey) // never start() -- see startRun()

    this.stageElapsedMs = 0
    this.planned = false
    this.shifting = false

    gameStore.patch({
      phase: PHASE.Playing,
      mode: plan.mode,
      nextMode: null,
      shiftIndex: gameStore.get().shiftIndex + 1,
      shiftWarning: false,
      lastDirectorNotes: plan.notes,
      secondsToShift: Math.ceil(runState.stageDurationMs() / 1000),
    })
  }

  private fallbackPlan(): StagePlan {
    const s = gameStore.get()
    const snapshot = metrics.snapshot(s.mode, this.stageElapsedMs, 1)
    return this.applyOverrides(
      this.director.decide(snapshot, {
        shiftIndex: s.shiftIndex,
        currentMode: s.mode,
        modeHistory: runState.modeHistory,
        chaosLastStage: runState.chaosLastStage,
      }),
      s.shiftIndex + 1,
    )
  }

  // --- telemetry & end of run -------------------------------------------

  private recordStage(plan: StagePlan): void {
    const s = gameStore.get()
    const totals = metrics.snapshot(s.mode, this.stageElapsedMs, s.health / s.maxHealth)
    telemetry.stageCompleted({
      shiftIndex: s.shiftIndex,
      mode: s.mode,
      durationMs: Math.round(this.stageElapsedMs),
      scoreAtEnd: s.score,
      healthAtEnd: s.health,
      damageTaken: totals.damageTaken,
      shotsFired: totals.shotsFired,
      shotsHit: totals.shotsHit,
      modifiers: runState.modifiers,
      directorNotes: plan.notes,
    })
  }

  private onStoreChange(): void {
    if (gameStore.get().phase !== PHASE.GameOver) return
    if (!this.activeKey) return
    this.endRun()
  }

  private endRun(): void {
    const s = gameStore.get()

    // Record the stage in progress so a run that ends mid-stage is not a hole
    // in the telemetry.
    telemetry.stageCompleted({
      shiftIndex: s.shiftIndex,
      mode: s.mode,
      durationMs: Math.round(this.stageElapsedMs),
      scoreAtEnd: s.score,
      healthAtEnd: 0,
      damageTaken: metrics.snapshot(s.mode, this.stageElapsedMs, 0).damageTaken,
      shotsFired: metrics.snapshot(s.mode, this.stageElapsedMs, 0).shotsFired,
      shotsHit: metrics.snapshot(s.mode, this.stageElapsedMs, 0).shotsHit,
      modifiers: runState.modifiers,
      directorNotes: s.lastDirectorNotes,
    })

    telemetry.runCompleted({
      runId: this.runId,
      startedAt: this.runStartedAt,
      endedAt: Date.now(),
      finalScore: s.lastRunScore || s.score,
      shifts: s.shiftIndex,
      stages: [],
    })

    // Let the death land before the scene disappears.
    this.time.delayedCall(600, () => this.stopActive())
  }

  private stopActive(): void {
    if (!this.activeKey) return
    this.scene.stop(this.activeKey)
    this.activeKey = null
    this.stageElapsedMs = 0
    this.planned = false
    this.shifting = false
  }

  /** Exposed for the HUD's "which mode is next" readout during a shift. */
  get pendingMode(): GameMode | null {
    return runState.pendingPlan?.mode ?? null
  }
}
