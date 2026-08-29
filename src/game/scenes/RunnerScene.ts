import Phaser from 'phaser'
import { metrics } from '../../state/metrics.ts'
import type { GameMode } from '../../state/types.ts'
import { MODE } from '../../state/types.ts'
import { ANIM } from '../art/anims.ts'
import { ATLAS_KEY } from '../art/atlas.ts'
import { sfx } from '../audio.ts'
import {
  DEPTH,
  DMG_OBSTACLE,
  COYOTE_MS,
  JUMP_BUFFER_MS,
  RUNNER_SCROLL_SPEED,
  RUNNER_SLIDE_MS,
  RUNNER_SPAWN_MS,
  SCORE_DODGE,
  SCORE_PICKUP,
  TILE_SIZE,
  VIEW_H,
  VIEW_W,
} from '../constants.ts'
import {
  BODY_SLIDE,
  BODY_STAND,
  FEET_Y,
  GATE_BOTTOM_Y,
  KIRK_DUCK_COSTUME_TOP_OFFSET,
  MAGA_DUCK_COSTUME_H,
  GROUND_Y,
  jumpVelocity,
  minGapPx,
  resolveGround,
  scrollSpeedAt,
} from '../runnerPacing.ts'
import type { InputState } from '../input.ts'
import { chance, makeRng, randInt } from '../rng.ts'
import type { Rng } from '../rng.ts'
import { runState } from '../../state/runState.ts'
import { MEME_SPRITE_ROLE } from '../../memeTheme/index.ts'
import { ModeScene } from './ModeScene.ts'
import { SCENE } from './keys.ts'

const OBSTACLE = {
  /** Sits on the floor: jump it. */
  Low: 'low',
  /** Ceiling gate: slide under it. */
  Gate: 'gate',
} as const
type ObstacleKind = (typeof OBSTACLE)[keyof typeof OBSTACLE]

/** Either an obstacle sprite or a gate rectangle -- both carry x/y and data. */
type Obstacle = Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle

/**
 * Mode C: fast-scrolling side runner. The avatar holds a fixed screen
 * position and auto-runs; the world comes at it. Low blocks must be jumped,
 * head-height overhangs must be slid under, and clearing either scores.
 *
 * The floor is handled by clamping Y rather than by a physics body: the
 * ground scrolls, and a moving static body needs refreshBody() every frame,
 * which costs more than the one comparison it replaces.
 */
export class RunnerScene extends ModeScene {
  readonly modeId: GameMode = MODE.Runner

  // All reset at the top of setupMode().
  private runner!: Phaser.Physics.Arcade.Sprite
  private ground!: Phaser.GameObjects.TileSprite
  private obstacles: Obstacle[] = []
  private chips!: Phaser.Physics.Arcade.Group
  private rng: Rng = makeRng(1)
  private scrollSpeed = RUNNER_SCROLL_SPEED
  private slideUntilMs = 0
  private nextSpawnMs = 0
  private onGround = false
  private coyoteMs = 0
  private jumpBufferMs = 0
  /** Set when a threat first appears, cleared when the player acts on it. */
  private threatSeenMs = 0
  /** One "SLIDE" prompt per run, the first time a gate appears. */
  private gateHintShown = false
  private runnerCostume?: Phaser.GameObjects.Graphics

  constructor() {
    super(SCENE.Runner)
  }

  protected setupMode(): void {
    this.obstacles = []
    this.rng = makeRng(Math.floor(Math.random() * 0xffffffff))
    this.scrollSpeed = RUNNER_SCROLL_SPEED
    this.slideUntilMs = 0
    this.nextSpawnMs = 0
    this.onGround = false
    this.coyoteMs = 0
    this.jumpBufferMs = 0
    this.threatSeenMs = 0
    this.gateHintShown = false
    this.runnerCostume = undefined

    this.cameras.main.setBackgroundColor('#120a1e')
    this.physics.world.setBounds(0, -80, VIEW_W, VIEW_H + 160)

    this.buildBackdrop()

    this.ground = this.add
      .tileSprite(VIEW_W / 2, GROUND_Y + TILE_SIZE, VIEW_W, TILE_SIZE * 2, ATLAS_KEY, 'tile-stone')
      .setDepth(DEPTH.Terrain)

    const dir = this.worldDir
    this.runner = this.physics.add
      .sprite(dir === 1 ? 64 : VIEW_W - 64, FEET_Y, ATLAS_KEY, 'player-idle')
      .setDepth(DEPTH.Player)
      .setFlipX(dir === -1)
    if (this.memeTheme.id === 'maga-rally' || this.memeTheme.id === 'kirk-mode') {
      this.runnerCostume = this.add.graphics().setDepth(DEPTH.Player + 1)
    }
    this.applyBody(BODY_STAND)
    this.avatar = this.runner

    this.chips = this.physics.add.group()
    this.physics.add.overlap(this.runner, this.chips, (_r, chip) => {
      this.collectChip(chip as Phaser.Physics.Arcade.Sprite)
    })
    this.physics.add.overlap(this.runner, this.obstacles, (_r, obs) => {
      this.onObstacleHit(obs as Obstacle)
    })
  }

  protected updateMode(input: InputState, time: number, delta: number): void {
    this.rampSpeed()
    this.ground.tilePositionX += this.worldDir * this.scrollSpeed * (delta / 1000)

    this.applyGround(delta)
    this.handleJump(input, delta)
    this.handleSlide(input, time)
    this.updateFrame()
    this.updateRunnerCostume()

    // Two gates, both of which must pass. The timer sets the desired density;
    // gapClear() is the physical floor. When the gap blocks a spawn we
    // deliberately do NOT advance nextSpawnMs, so the spawn happens the
    // instant it becomes survivable rather than being skipped.
    if (time >= this.nextSpawnMs && this.gapClear()) {
      this.spawnWave()
      this.nextSpawnMs = time + this.spawnIntervalMs(RUNNER_SPAWN_MS)
    }

    this.scrollEntities(delta)
  }

  protected teardownMode(): void {
    this.obstacles.length = 0
    this.runnerCostume?.destroy()
    this.runnerCostume = undefined
  }

  // --- construction ---------------------------------------------------------

  private buildBackdrop(): void {
    if (this.memeTheme.id === 'tabloid-island') {
      this.buildIslandBackdrop()
      return
    }
    const g = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.Background)
    // Receding horizontal rules read as speed lines once things start moving.
    for (let i = 0; i < 14; i++) {
      const y = 20 + i * 9
      g.fillStyle(i % 2 === 0 ? 0xff3ea5 : 0x3ef0ff, 0.06 + i * 0.008)
      g.fillRect(0, y, VIEW_W, 1)
    }
  }

  private buildIslandBackdrop(): void {
    const g = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.Background)
    g.fillStyle(0x071a2a, 0.95)
    g.fillRect(0, 0, VIEW_W, VIEW_H)
    g.fillStyle(0x1080a0, 0.3)
    g.fillRect(0, GROUND_Y - 16, VIEW_W, VIEW_H - GROUND_Y + 16)
    for (let x = 32; x < VIEW_W; x += 82) {
      g.fillStyle(0xffe14d, 0.42)
      g.fillEllipse(x, GROUND_Y - 8, 72, 16)
      g.fillStyle(0xffc9a0, 0.62)
      g.fillRect(x - 18, GROUND_Y - 47, 4, 36)
      g.fillStyle(0x1c7a4a, 0.78)
      g.fillEllipse(x - 25, GROUND_Y - 50, 26, 9)
      g.fillEllipse(x - 14, GROUND_Y - 56, 26, 9)
      g.fillStyle(0xff9a2e, 0.86)
      g.fillCircle(x - 14, GROUND_Y - 50, 2)
      g.fillStyle(0xf2eeff, 0.48)
      g.fillRect(x + 10, GROUND_Y - 66, 36, 26)
      g.fillStyle(0xffe14d, 0.4)
      g.fillTriangle(x + 7, GROUND_Y - 66, x + 28, GROUND_Y - 82, x + 49, GROUND_Y - 66)
    }
  }

  private updateRunnerCostume(): void {
    const g = this.runnerCostume
    if (!g) return
    g.clear()
    const x = this.runner.x
    const y = this.runner.y
    if (this.memeTheme.id === 'kirk-mode') {
      g.lineStyle(1, 0x08060f, 1)
      if (this.time.now < this.slideUntilMs) {
        const top = y - KIRK_DUCK_COSTUME_TOP_OFFSET
        g.fillStyle(0xffc9a0, 1)
        g.fillRect(x - 6, top, 12, 6)
        g.strokeRect(x - 6, top, 12, 6)
        g.fillStyle(0x3b2318, 1)
        g.fillRect(x - 6, top, 12, 2)
        g.fillRect(x + 4, top + 1, 2, 2)
        g.fillStyle(0x08060f, 1)
        g.fillRect(x - 1, top + 3, 1, 1)
        g.fillRect(x + 1, top + 3, 1, 1)
        g.fillRect(x - 1, top + 5, 4, 1)
        g.fillStyle(0x1b1830, 1)
        g.fillRect(x - 5, y - 1, 3, 1)
        g.fillRect(x + 2, y - 1, 3, 1)
        return
      }
      g.fillStyle(0x1b2440, 0.98)
      g.fillRect(x - 6, y - 6, 12, 9)
      g.strokeRect(x - 6, y - 6, 12, 9)
      g.fillStyle(0xf2eeff, 1)
      g.fillRect(x - 3, y - 6, 6, 3)
      g.fillStyle(0x7a4534, 1)
      g.fillRect(x - 1, y - 5, 2, 6)
      g.fillStyle(0xffc9a0, 1)
      g.fillRect(x - 5, y - 16, 10, 8)
      g.strokeRect(x - 5, y - 16, 10, 8)
      g.fillStyle(0x3b2318, 1)
      g.fillRect(x - 5, y - 18, 10, 3)
      g.fillRect(x - 3, y - 20, 8, 2)
      g.fillRect(x + 4, y - 17, 2, 4)
      g.fillStyle(0x08060f, 1)
      g.fillRect(x - 1, y - 12, 1, 1)
      g.fillRect(x + 1, y - 12, 1, 1)
      g.fillRect(x - 1, y - 9, 4, 1)
      return
    }
    if (this.time.now < this.slideUntilMs) {
      g.lineStyle(1, 0x08060f, 1)
      g.fillStyle(0xffc9a0, 1)
      const top = y - MAGA_DUCK_COSTUME_H + 12
      g.fillRect(x - 5, top + 2, 10, 7)
      g.strokeRect(x - 5, top + 2, 10, 7)
      g.fillStyle(0x08060f, 1)
      g.fillRect(x - 3, top + 5, 2, 1)
      g.fillRect(x + 2, top + 5, 2, 1)
      g.fillRect(x + 1, top + 7, 5, 1)
      g.fillStyle(0xff9a2e, 1)
      g.fillRect(x - 6, top, 11, 2)
      g.fillRect(x - 7, top + 2, 3, 4)
      g.fillRect(x + 3, top + 1, 5, 2)
      g.fillStyle(0x1b1830, 1)
      g.fillRect(x - 5, y - 2, 3, 2)
      g.fillRect(x + 2, y - 2, 3, 2)
      return
    }
    g.lineStyle(1, 0x08060f, 1)
    g.fillStyle(0x1c2f8c, 0.98)
    g.fillRect(x - 7, y - 6, 14, 9)
    g.strokeRect(x - 7, y - 6, 14, 9)
    g.fillStyle(0xf2eeff, 1)
    g.fillTriangle(x - 5, y - 6, x - 1, y - 6, x - 2, y - 2)
    g.fillTriangle(x + 5, y - 6, x + 1, y - 6, x + 2, y - 2)
    g.fillStyle(0xff4d4d, 1)
    g.fillRect(x - 1, y - 5, 2, 5)
    g.fillTriangle(x - 2, y, x + 2, y, x, y + 3)
    g.fillStyle(0xffc9a0, 1)
    g.fillRect(x - 5, y - 16, 10, 8)
    g.strokeRect(x - 5, y - 16, 10, 8)
    g.fillStyle(0x08060f, 1)
    g.fillRect(x - 3, y - 12, 2, 1)
    g.fillRect(x + 2, y - 12, 2, 1)
    g.fillRect(x + 1, y - 9, 5, 1)
    g.fillStyle(0xff9a2e, 1)
    g.fillRect(x - 6, y - 19, 11, 3)
    g.fillRect(x - 7, y - 17, 3, 7)
    g.fillRect(x + 3, y - 18, 5, 2)
    g.fillRect(x + 7, y - 20, 2, 4)
    g.fillStyle(0xffe14d, 0.85)
    g.fillRect(x - 5, y - 19, 8, 1)
  }

  private applyBody(shape: { w: number; h: number; ox: number; oy: number }): void {
    ;(this.runner.body as Phaser.Physics.Arcade.Body)
      .setSize(shape.w, shape.h)
      .setOffset(shape.ox, shape.oy)
  }

  // --- movement --------------------------------------------------------------

  /**
   * Speed ramps across the stage so the last seconds before a shift are the
   * hardest. Uses the director's stage length, so a shortened stage ramps
   * faster rather than simply ending sooner.
   */
  private rampSpeed(): void {
    const total = runState.stageDurationMs()
    const progress = (this.time.now - runState.stageStartMs) / total
    this.scrollSpeed = scrollSpeedAt(progress, this.mods.playerSpeedScale)
  }

  /** True when the last obstacle is far enough along to add another. */
  private gapClear(): boolean {
    const last = this.obstacles[this.obstacles.length - 1]
    if (!last) return true
    // Measured in worldDir terms so it holds when the stage is mirrored.
    const travelled = (this.spawnX() - last.x) * this.worldDir
    return travelled >= minGapPx(this.scrollSpeed, this.physics.world.gravity.y, this.mods.spawnRateScale)
  }

  private spawnX(): number {
    return this.worldDir === 1 ? VIEW_W + 20 : -20
  }

  private applyGround(delta: number): void {
    const body = this.runner.body as Phaser.Physics.Arcade.Body
    const { lift, onGround } = resolveGround(body.bottom, body.velocity.y)

    if (onGround) {
      if (lift !== 0) {
        // Correct BOTH: the body so this frame's collision checks are right,
        // and the sprite because postUpdate only adds a delta on top of it.
        // Negative lift is the small floor snap for near-ground drift.
        body.y -= lift
        this.runner.y -= lift
      }
      body.setVelocityY(0)
      if (!this.onGround) sfx.land()
      this.coyoteMs = COYOTE_MS
    } else {
      this.coyoteMs = Math.max(0, this.coyoteMs - delta)
    }
    this.onGround = onGround
  }

  private handleJump(input: InputState, delta: number): void {
    this.jumpBufferMs = input.jumpJustPressed
      ? JUMP_BUFFER_MS
      : Math.max(0, this.jumpBufferMs - delta)

    if (this.jumpBufferMs <= 0 || this.coyoteMs <= 0) return
    if (this.time.now < this.slideUntilMs) return
    ;(this.runner.body as Phaser.Physics.Arcade.Body).setVelocityY(
      jumpVelocity(this.physics.world.gravity.y),
    )
    this.onGround = false
    this.coyoteMs = 0
    this.jumpBufferMs = 0
    sfx.jump()
    metrics.jumped()
    this.noteReaction()
  }

  private handleSlide(input: InputState, time: number): void {
    const sliding = time < this.slideUntilMs

    if (input.slideHeld && !sliding && this.onGround) {
      this.slideUntilMs = time + RUNNER_SLIDE_MS
      this.applyBody(BODY_SLIDE)
      sfx.slide()
      this.noteReaction()
      return
    }

    // Restoring the standing body is what makes the slide a real commitment:
    // it ends on a timer, not on releasing the key.
    if (!sliding && this.runner.frame.name === 'player-slide') {
      this.applyBody(BODY_STAND)
    }
  }

  private updateFrame(): void {
    if (this.time.now < this.slideUntilMs) {
      this.runner.anims.stop()
      this.runner.setFrame('player-slide')
    } else if (!this.onGround) {
      this.runner.anims.stop()
      const vy = (this.runner.body as Phaser.Physics.Arcade.Body).velocity.y
      this.runner.setFrame(vy < 0 ? 'player-jump' : 'player-fall')
    } else {
      this.runner.anims.play(ANIM.Walk, true)
    }
  }

  /** Time from a threat becoming visible to the player acting on it. */
  private noteReaction(): void {
    if (this.threatSeenMs === 0) return
    metrics.reacted(this.time.now - this.threatSeenMs)
    this.threatSeenMs = 0
  }

  // --- world ------------------------------------------------------------------

  private spawnWave(): void {
    const dir = this.worldDir
    const spawnX = this.spawnX()
    const kind: ObstacleKind = chance(this.rng, 0.5) ? OBSTACLE.Low : OBSTACLE.Gate
    const obs = kind === OBSTACLE.Low ? this.spawnBlock(spawnX) : this.spawnGate(spawnX)

    obs.setData('kind', kind)
    obs.setData('scored', false)
    this.obstacles.push(obs)

    // Half of all obstacles are gates that CANNOT be jumped. That is the
    // design, but nothing taught it, and players read an unjumpable obstacle
    // as a broken jump. One prompt per run is enough.
    if (kind === OBSTACLE.Gate && !this.gateHintShown) {
      this.gateHintShown = true
      this.showSlideHint()
    }

    this.threatSeenMs = this.time.now

    // A chip in the reward position for the correct answer: high above a low
    // block (so jumping collects it), at floor level past a gate (so sliding
    // does). The chip is what turns "avoid the thing" into "commit to it".
    if (chance(this.rng, 0.6)) {
      const chipY = kind === OBSTACLE.Low ? GROUND_Y - 46 : GROUND_Y - 4
      const chip = this.chips.create(
        spawnX + dir * randInt(this.rng, 10, 26),
        chipY,
        ATLAS_KEY,
        'chip',
      ) as Phaser.Physics.Arcade.Sprite
      chip.setDepth(DEPTH.Pickup)
      chip.setTint(this.memeAccent(0, 0x3ef0ff))
      ;(chip.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(8, 8).setOffset(4, 4)
    }
  }

  private spawnBlock(x: number): Phaser.GameObjects.Sprite {
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.RunnerObstacle, 'obstacle')
    const obs = this.physics.add.sprite(x, FEET_Y, sprite.key, sprite.frame).setDepth(DEPTH.Enemy)
    obs.setTint(this.memeAccent(1, 0xff3ea5))
    ;(obs.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(14, 14).setOffset(1, 1)
    return obs
  }

  /** A hazard beam hanging from the ceiling. Rendered as a rectangle rather
   *  than stacked tiles: one body, one draw, and it reads as "duck". */
  private spawnGate(x: number): Phaser.GameObjects.Rectangle {
    const gate = this.add
      .rectangle(x, GATE_BOTTOM_Y / 2, 10, GATE_BOTTOM_Y, 0xff3ea5, 0.85)
      .setDepth(DEPTH.Enemy)
    gate.setFillStyle(this.memeAccent(1, 0xff3ea5), 0.85)
    gate.setStrokeStyle(1, this.memeAccent(2, 0xffe14d), 0.9)
    this.physics.add.existing(gate)
    ;(gate.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true)

    // A chevron at the beam's tip, pulsing downward. The affordance has to say
    // "go under this", not just "hazard" -- the beam alone reads as something
    // to jump, which is the one thing that cannot work.
    const chevron = this.add
      .triangle(x, GATE_BOTTOM_Y + 7, 0, 0, 10, 0, 5, 7, this.memeAccent(2, 0xffe14d), 0.95)
      .setDepth(DEPTH.Enemy)
    const label = this.add
      .text(x, GATE_BOTTOM_Y + 18, this.memeTheme.modeFlavor[this.modeId].hazard, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '7px',
        color: this.memeTheme.palette[0] ?? '#3ef0ff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.Enemy)
    this.tweens.add({
      targets: chevron,
      y: GATE_BOTTOM_Y + 12,
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    // Carried on the gate so scrollEntities moves and destroys them together.
    gate.setData('chevron', chevron)
    gate.setData('label', label)

    return gate
  }

  /** One-shot "SLIDE" prompt above the avatar, the first time a gate appears. */
  private showSlideHint(): void {
    const hint = this.add
      .text(this.runner.x, GROUND_Y - 58, this.memeTheme.modeFlavor[this.modeId].obstacle, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '11px',
        color: this.memeTheme.palette[2] ?? '#ffe14d',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.Fog)

    this.tweens.add({
      targets: hint,
      y: GROUND_Y - 70,
      alpha: 0,
      delay: 1100,
      duration: 700,
      onComplete: () => hint.destroy(),
    })
  }

  private scrollEntities(delta: number): void {
    const dx = -this.worldDir * this.scrollSpeed * (delta / 1000)
    const dir = this.worldDir

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]
      obs.x += dx

      // A gate's chevron is a separate object; it travels and dies with it.
      const chevron = obs.getData('chevron') as Phaser.GameObjects.Triangle | undefined
      if (chevron) chevron.x = obs.x
      const label = obs.getData('label') as Phaser.GameObjects.Text | undefined
      if (label) label.x = obs.x

      // Cleared it: score once, as it passes behind the runner.
      if (!obs.getData('scored') && (obs.x - this.runner.x) * dir < -10) {
        obs.setData('scored', true)
        this.award(SCORE_DODGE)
        this.rewardStreak()
      }

      if (dir === 1 ? obs.x < -24 : obs.x > VIEW_W + 24) {
        chevron?.destroy()
        label?.destroy()
        obs.destroy()
      }
      if (!obs.active) this.obstacles.splice(i, 1)
    }

    for (const obj of this.chips.getChildren()) {
      const chip = obj as Phaser.Physics.Arcade.Sprite
      chip.x += dx
      if (dir === 1 ? chip.x < -24 : chip.x > VIEW_W + 24) chip.destroy()
    }
  }

  // --- events -------------------------------------------------------------------

  private collectChip(chip: Phaser.Physics.Arcade.Sprite): void {
    if (!chip.active) return
    chip.destroy()
    sfx.pickup()
    metrics.pickedUp()
    this.award(SCORE_PICKUP)
    this.rewardStreak()
  }

  private onObstacleHit(obs: Obstacle): void {
    if (!obs.active || obs.getData('scored')) return
    if (!this.takeDamage(DMG_OBSTACLE)) return
    // Mark it scored-but-failed so clearing it afterwards can't also pay out.
    obs.setData('scored', true)
  }
}
