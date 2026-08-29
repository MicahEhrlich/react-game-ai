import Phaser from 'phaser'
import { DEV } from '../../dev.ts'
import type { StageModifiers } from '../../director/types.ts'
import { metrics } from '../../state/metrics.ts'
import { runState } from '../../state/runState.ts'
import { gameStore } from '../../state/store.ts'
import type { GameMode } from '../../state/types.ts'
import { GRAVITY_Y, INVULN_BLINK_MS, INVULN_MS, MAX_MULTIPLIER } from '../constants.ts'
import { sfx } from '../audio.ts'
import { TAUNT, playTaunt } from '../taunts.ts'
import { InputReader, NEUTRAL_INPUT } from '../input.ts'
import type { InputState } from '../input.ts'
import { PHASE, acceptsGameplayDamage } from '../../state/types.ts'
import { addFog } from '../art/fog.ts'
import { memeAccentNumber, themeForMode } from '../../memeTheme/index.ts'
import type { MemeSpriteRole, MemeTheme } from '../../memeTheme/index.ts'
import { spriteForRole } from '../art/memeAtlas.ts'
import type { SpriteRef } from '../art/memeAtlas.ts'

/**
 * Base for PlatformerScene / SpaceShooterScene / RunnerScene.
 *
 * It owns everything the three modes must agree on -- input, scoring,
 * damage, invulnerability, and how StageModifiers are applied -- so a mode
 * file contains only that mode's gameplay.
 *
 * CRITICAL (see the Invariant Delta in the plan): Phaser instantiates each
 * Scene ONCE. `scene.start()` on a stopped scene re-runs create() on the SAME
 * instance, with every field still holding its previous stage's value. This
 * class resets its own fields at the top of create(); a subclass MUST reset
 * its own at the top of setupMode(). Adding a field and its reset is one edit,
 * never two.
 */
/**
 * What the base class needs from "the player's on-screen thing": a position
 * to centre the fog on, and a visibility flag to blink for i-frames. A plain
 * Sprite satisfies this, and so does a Rectangle -- which is what widens this
 * from Sprite to an intersection: BREAKDOWN's paddle is a
 * Phaser.GameObjects.Rectangle, not a sprite, and both classes already
 * implement Transform and Visible directly (verified against phaser.d.ts).
 */
type AvatarLike = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.Visible

export abstract class ModeScene extends Phaser.Scene {
  abstract readonly modeId: GameMode

  /** Modifiers this stage was BUILT with. Snapshotted so a mid-stage change
   *  to runState can never desync a scene from the world it created. */
  protected mods: StageModifiers = runState.modifiers

  /** Renamed from `input` -- Phaser.Scene.input is the InputPlugin. */
  protected controls!: InputReader

  /** Assigned by setupMode(); the base handles its invulnerability blink. */
  protected avatar: AvatarLike | null = null

  private invulnUntil = 0
  private fog: Phaser.GameObjects.Image | null = null

  /**
   * +1 normally, -1 when the mirrorWorld modifier is on. Modes apply this to
   * their LAYOUT (which side enemies enter from, which way the world scrolls)
   * rather than to the camera -- mirroring the actual play space is both more
   * interesting and far more robust than a rendering trick.
   */
  protected get worldDir(): 1 | -1 {
    return this.mods.mirrorWorld ? -1 : 1
  }

  protected get isInvulnerable(): boolean {
    return this.time.now < this.invulnUntil
  }

  /**
   * What the fog spotlight follows. Defaults to the avatar, which is right
   * for every mode where the player character is the thing you must watch.
   *
   * BREAKDOWN is not one of those: the player controls the paddle at a fixed
   * y near the bottom of the view, but must watch the BALL, which spends most
   * of a rally far from the paddle. A paddle-anchored spotlight would leave
   * the ball dim-to-invisible for most of its flight (measured against the
   * fog's actual gradient stops: the clear radius from a paddle at y=178
   * only reaches y=~109). BrickScene overrides this to return the ball.
   *
   * A GETTER, not a field: a field would need its own invariant-1 reset, and
   * worse, it would go on pointing at a destroyed ball across a respawn --
   * updateFog() reads .x/.y on a destroyed GameObject without throwing, so
   * the spotlight would silently freeze at the point of loss. Overriding the
   * getter to always return the CURRENT ball sidesteps both problems.
   */
  protected get fogAnchor(): AvatarLike | null {
    return this.avatar
  }

  create(): void {
    // --- field resets: everything declared above, every time ---
    this.mods = runState.modifiers
    this.avatar = null
    this.invulnUntil = 0
    this.fog = null

    // Each scene owns its own arcade World, so gravity must be set here and
    // not inherited from the game config (the shooter sets it to zero).
    this.physics.world.gravity.y = GRAVITY_Y * this.mods.gravityScale

    this.controls = new InputReader(this, this.mods, this.modeId)

    this.setupMode()

    if (this.mods.fogOfWar) {
      this.fog = addFog(this)
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownMode())
  }

  update(time: number, delta: number): void {
    const phase = gameStore.get().phase

    // Physics keeps stepping during PHASE.Shifting -- the world drifting
    // behind the glitch overlay looks right -- but the player loses control
    // and no mode logic runs.
    if (phase !== PHASE.Playing) {
      this.updateMode(NEUTRAL_INPUT, time, delta)
      return
    }

    metrics.tickMode(this.modeId, delta)
    this.updateMode(this.controls.read(), time, delta)
    this.updateInvulnBlink()
    this.updateFog()
  }

  // --- hooks for subclasses ------------------------------------------

  /** Build the stage. MUST begin by resetting the subclass's own fields. */
  protected abstract setupMode(): void

  /** Per-frame gameplay. `input` is NEUTRAL_INPUT whenever play is frozen. */
  protected abstract updateMode(input: InputState, time: number, delta: number): void

  /** Optional extra cleanup on SHUTDOWN. */
  protected teardownMode(): void {}

  // --- shared scoring & damage ---------------------------------------

  /**
   * The single scoring path for all three modes. `base` is the un-multiplied
   * value from constants.ts; the run multiplier and the director's
   * scoreMultiplier are applied here so no mode can forget either.
   */
  protected award(base: number): void {
    const points = Math.round(base * gameStore.get().multiplier * this.mods.scoreMultiplier)
    gameStore.addScore(points)
    metrics.scoredIn(this.modeId, points)
  }

  /** Call on a clean success (pickup, kill, dodge). */
  protected rewardStreak(): void {
    const before = gameStore.get().multiplier
    gameStore.bumpMultiplier(1, MAX_MULTIPLIER)
    const after = gameStore.get().multiplier
    if (after !== before) {
      sfx.multiplier(after)
      if (after >= 5) playTaunt(TAUNT.Streak, 0.35)
    }
  }

  /**
   * The single damage path. Returns false when the hit was ignored (i-frames
   * or ?god=1), so callers can skip destroying the thing that hit us.
   */
  protected takeDamage(amount: number): boolean {
    if (!acceptsGameplayDamage(gameStore.get().phase)) return false
    if (DEV.god) return false
    if (this.isInvulnerable) return false

    this.invulnUntil = this.time.now + INVULN_MS
    metrics.damaged(amount)
    sfx.hurt()

    this.cameras.main.shake(140, 0.012)
    this.cameras.main.flash(90, 255, 62, 165)

    const health = gameStore.damage(amount)
    if (health <= 0) {
      sfx.gameOver()
      playTaunt(TAUNT.GameOver, 0.6)
    } else {
      playTaunt(TAUNT.Hurt, 0.3)
    }
    return true
  }

  // --- shared modifier plumbing ---------------------------------------

  /** Scaled speed for anything the player controls. */
  protected playerSpeed(base: number): number {
    return base * this.mods.playerSpeedScale
  }

  /** Scaled speed for any projectile, friendly or hostile. */
  protected projectileSpeed(base: number): number {
    return base * this.mods.projectileSpeedScale
  }

  protected get memeTheme(): MemeTheme {
    return themeForMode(gameStore.get().memeTheme, this.modeId, gameStore.get().shiftIndex)
  }

  protected memeAccent(index: number, fallback = 0x3ef0ff): number {
    return memeAccentNumber(this.memeTheme, index, fallback)
  }

  protected memeSprite(role: MemeSpriteRole, fallbackFrame: string): SpriteRef {
    return spriteForRole(this, this.memeTheme, role, fallbackFrame)
  }

  /**
   * Scaled spawn interval. Note the DIVISION: a higher spawnRateScale means
   * more things per second, so the gap between them shrinks.
   */
  protected spawnIntervalMs(baseMs: number): number {
    return Math.max(120, baseMs / this.mods.spawnRateScale)
  }

  // --- internals -------------------------------------------------------

  private updateInvulnBlink(): void {
    const a = this.avatar
    if (!a) return
    a.setVisible(
      !this.isInvulnerable || Math.floor(this.time.now / INVULN_BLINK_MS) % 2 === 0,
    )
  }

  /** Keeps the fog spotlight centred on the anchor's on-screen position. */
  private updateFog(): void {
    const f = this.fog
    const a = this.fogAnchor
    if (!f || !a) return
    const cam = this.cameras.main
    f.setPosition(a.x - cam.scrollX, a.y - cam.scrollY)
  }

}
