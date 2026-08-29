import Phaser from 'phaser'
import { DEV } from '../../dev.ts'
import { makeDirector } from '../../director/index.ts'
import { activeChaos, clampModifiers } from '../../director/modifiers.ts'
import { getOverride, primeOverrides } from '../../director/stageOverrides.ts'
import { newRunId, telemetry } from '../../director/telemetry.ts'
import type { StageRecord } from '../../director/telemetry.ts'
import { isLiveDirector, PLAN_SOURCE } from '../../director/types.ts'
import type {
  Director,
  LiveDirector,
  RunMetrics,
  StageBrief,
  StagePlan,
} from '../../director/types.ts'
import { loadPacing } from '../../director/pacing.ts'
import { metrics } from '../../state/metrics.ts'
import { loadDailyMemeTheme } from '../../memeTheme/daily.ts'
import { commands } from '../../state/commands.ts'
import { pickStartMode, runState } from '../../state/runState.ts'
import { gameStore } from '../../state/store.ts'
import type { GameCommand, GameMode } from '../../state/types.ts'
import { PHASE } from '../../state/types.ts'
import { sfx, unlockAudio } from '../audio.ts'
import { music } from '../music.ts'
import { runCorruption } from '../art/corruption.ts'
import {
  GLITCH_DURATION_CHAOS_MS,
  GLITCH_DURATION_MS,
  SCORE_SURVIVE_SHIFT,
  SHIFT_WARNING_MS,
} from '../constants.ts'
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
/** StageRecord is what telemetry stores; StageBrief is what a director is
 *  allowed to see. maxHealth is constant across a run, so it comes from the
 *  store rather than being duplicated into every record. */
function toStageBrief(r: StageRecord, maxHealth: number): StageBrief {
  return {
    shiftIndex: r.shiftIndex,
    mode: r.mode,
    seconds: Math.round(r.durationMs / 1000),
    scoreAtEnd: r.scoreAtEnd,
    healthPct: maxHealth > 0 ? Math.round((r.healthAtEnd / maxHealth) * 100) : 0,
    damageTaken: r.damageTaken,
    accuracyPct: r.shotsFired > 0 ? Math.round((r.shotsHit / r.shotsFired) * 100) : null,
    notes: r.directorNotes,
  }
}

export class ShiftDirectorScene extends Phaser.Scene {
  private director: Director = makeDirector()
  /** The same object as `director` when it can talk to something slow, else
   *  null. Kept separately so the hot path never re-narrows. */
  private live: LiveDirector | null = null
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
    this.director = makeDirector()
    this.live = isLiveDirector(this.director) ? this.director : null
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
    // Re-read the pacing config each run, so editing public/config/pacing.json
    // takes effect on the next run without a rebuild or even a reload.
    void loadPacing()

    // Picked ONCE and handed to both channels, so runState's mode history and
    // gameStore's `mode` can never disagree about how the run began.
    const mode = pickStartMode()

    metrics.resetRun()
    runState.resetRun(this.time.now, mode)
    gameStore.startRun(mode)
    music.play(gameStore.get().memeTheme.musicPlan)

    this.runId = newRunId()
    this.runStartedAt = Date.now()
    this.stageElapsedMs = 0
    this.planned = false
    this.shifting = false

    // Drops every scrap of the previous run and aborts anything still in
    // flight from it. Same fire-and-forget spirit as the two calls above.
    this.live?.beginRun(this.runId)
    this.primeMemeTheme(this.runId)

    // launch(), never start(): ScenePlugin.start queues a stop on the CALLING
    // scene, so starting a mode from here would shut the director down and
    // silently freeze the shift clock along with it.
    this.activeKey = SCENE_FOR_MODE[mode]
    this.scene.launch(this.activeKey)
  }

  private pause(): void {
    if (gameStore.get().phase !== PHASE.Playing || !this.activeKey) return
    gameStore.patch({ phase: PHASE.Paused })
    this.scene.pause(this.activeKey)
    music.pause()
    touch.releaseAll()
  }

  private resume(): void {
    if (gameStore.get().phase !== PHASE.Paused || !this.activeKey) return
    this.scene.resume(this.activeKey)
    gameStore.patch({ phase: PHASE.Playing })
    music.resume()
  }

  private quitToMenu(): void {
    this.stopActive()
    music.stop()
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
   *
   * Note what clampModifiers does NOT do: it bounds numbers and allows at most
   * one chaos flag, but it has never seen `plan.mode` and knows no history. So
   * "never repeat the current mode" and the two chaos-timing rules are not
   * enforced here. For an untrusted (model-authored) plan they are enforced in
   * director/llmPlan.ts, and nowhere else.
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

    // Surface the INCOMING stage's notes and chaos flag now, not after the
    // swap -- the overlay is the only place the player sees why the game just
    // changed, and activeChaos also drives the HUD badge for the whole of the
    // stage that is about to start.
    const chaos = runState.pendingPlan ? activeChaos(runState.pendingPlan.modifiers) : null

    gameStore.patch({
      phase: PHASE.Shifting,
      secondsToShift: 0,
      nextMode: runState.pendingPlan?.mode ?? null,
      lastDirectorNotes: runState.pendingPlan?.notes ?? [],
      activeChaos: chaos,
    })
    sfx.glitch()
    playTaunt(TAUNT.Shift, 0.55)
    touch.releaseAll()

    // A stage that inverts your controls needs longer on screen than one that
    // just nudges a spawn rate -- the player has to actually read it.
    const duration = chaos ? GLITCH_DURATION_CHAOS_MS : GLITCH_DURATION_MS

    if (this.activeKey) {
      const active = this.scene.get(this.activeKey)
      if (active) runCorruption(active, duration)
    }

    this.time.delayedCall(duration, () => this.completeShift())
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

    // Snapshotted ONCE, before metrics.rollShift() clears the window below.
    // Telemetry and the director then describe identical numbers, and the
    // director gets the stage that actually just happened.
    const closing = gameStore.get()
    const closingMetrics = metrics.snapshot(
      closing.mode,
      this.stageElapsedMs,
      closing.maxHealth > 0 ? closing.health / closing.maxHealth : 0,
    )

    this.recordStage(plan, closingMetrics)

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
      // Rides this patch rather than adding one: no extra re-render, and
      // nothing per-frame reaches the store (invariant 2).
      directorSource: this.live?.lastSource ?? PLAN_SOURCE.Heuristic,
    })

    // LAST, so it reads the post-patch shiftIndex. See primeDirector().
    this.primeDirector(closingMetrics)
  }

  /**
   * Prefetch the plan for the stage AFTER the one that just started, giving it
   * a whole stage -- 30 to 90 seconds -- instead of the 3s warning window.
   * Fire-and-forget: a stage must never wait on this, and a failure just means
   * the heuristic decides.
   *
   * The shift index has to match what planNextStage() will pass to decide():
   * both read gameStore.shiftIndex for the stage being PLAYED, and the plan is
   * for that index plus one. Reading it from the store after the patch above
   * -- rather than computing it here -- is what keeps the two in step. Get
   * this wrong by one and nothing errors: the cache simply never hits and the
   * heuristic quietly serves every stage.
   */
  private primeDirector(closingMetrics: RunMetrics): void {
    if (!this.live) return
    const s = gameStore.get()
    const stages = telemetry.currentStages().map((r) => toStageBrief(r, s.maxHealth))
    this.live.prime(
      closingMetrics,
      {
        shiftIndex: s.shiftIndex,
        currentMode: s.mode,
        modeHistory: runState.modeHistory,
        chaosLastStage: runState.chaosLastStage,
      },
      stages,
    )
  }

  private primeMemeTheme(runId: string): void {
    void loadDailyMemeTheme(undefined, undefined, undefined, DEV.memeId, DEV.adultMemeMode).then((theme) => {
      if (this.runId !== runId) return
      const phase = gameStore.get().phase
      if (phase === PHASE.Menu || phase === PHASE.GameOver) return
      gameStore.patch({ memeTheme: theme })
      music.play(theme.musicPlan)
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

  /** `totals` is passed in rather than sampled here, so the record and the
   *  director's view of the stage cannot disagree. */
  private recordStage(plan: StagePlan, totals: RunMetrics): void {
    const s = gameStore.get()
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
    const final = metrics.snapshot(s.mode, this.stageElapsedMs, 0)

    // Record the stage in progress so a run that ends mid-stage is not a hole
    // in the telemetry.
    telemetry.stageCompleted({
      shiftIndex: s.shiftIndex,
      mode: s.mode,
      durationMs: Math.round(this.stageElapsedMs),
      scoreAtEnd: s.score,
      healthAtEnd: 0,
      damageTaken: final.damageTaken,
      shotsFired: final.shotsFired,
      shotsHit: final.shotsHit,
      modifiers: runState.modifiers,
      directorNotes: s.lastDirectorNotes,
    })

    // Read BEFORE runCompleted, which flushes the sink's buffer.
    const stages = telemetry.currentStages().map((r) => toStageBrief(r, s.maxHealth))

    telemetry.runCompleted({
      runId: this.runId,
      startedAt: this.runStartedAt,
      endedAt: Date.now(),
      finalScore: s.lastRunScore || s.score,
      shifts: s.shiftIndex,
      stages: [],
    })

    this.requestEpitaph(s.lastRunScore || s.score, s.shiftIndex, s.mode, stages)

    // Let the death land before the scene disappears.
    music.stop()
    this.time.delayedCall(600, () => this.stopActive())
  }

  /**
   * The last thing the player reads before deciding whether to go again.
   *
   * Deliberately not awaited and deliberately not blocking the panel: it
   * arrives a second or two late, which reads as the machine composing the
   * line rather than as a delay. The patch is issued from here because the
   * orchestrator owns the Phaser->React channel -- a director reaching into
   * gameStore itself would be a third bridge (invariant 3).
   */
  private requestEpitaph(
    finalScore: number,
    shifts: number,
    finalMode: GameMode,
    stages: readonly StageBrief[],
  ): void {
    if (!this.live) return
    const runId = this.runId

    void this.live
      .epitaph({ runId, finalScore, shifts, finalMode, stages })
      .then((line) => {
        if (!line) return
        // The player may have restarted or walked back to the menu while this
        // was in flight; either way the line is about a run that is no longer
        // on screen.
        if (this.runId !== runId) return
        if (gameStore.get().phase !== PHASE.GameOver) return
        gameStore.patch({ runEpitaph: line })
      })
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
