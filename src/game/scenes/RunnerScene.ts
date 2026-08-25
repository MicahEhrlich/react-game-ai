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
  RUNNER_JUMP_VELOCITY,
  RUNNER_MAX_SCROLL_SPEED,
  RUNNER_SCROLL_SPEED,
  RUNNER_SLIDE_MS,
  RUNNER_SPAWN_MS,
  SCORE_DODGE,
  SCORE_PICKUP,
  TILE_SIZE,
  VIEW_H,
  VIEW_W,
} from '../constants.ts'
import type { InputState } from '../input.ts'
import { chance, makeRng, randInt } from '../rng.ts'
import type { Rng } from '../rng.ts'
import { runState } from '../../state/runState.ts'
import { ModeScene } from './ModeScene.ts'
import { SCENE } from './keys.ts'

const GROUND_Y = VIEW_H - TILE_SIZE * 2
/** Standing body. */
const BODY_STAND = { w: 10, h: 14, ox: 3, oy: 1 }
/** Sliding body: short enough to clear a head-height overhang. */
const BODY_SLIDE = { w: 12, h: 7, ox: 2, oy: 8 }

const OBSTACLE = {
  /** Sits on the floor: jump it. */
  Low: 'low',
  /** Ceiling gate: slide under it. */
  Gate: 'gate',
} as const
type ObstacleKind = (typeof OBSTACLE)[keyof typeof OBSTACLE]

/**
 * The gate hangs from the top of the view down to GATE_BOTTOM_Y, which is
 * chosen against the two player bodies rather than by eye:
 *
 *   standing body  146..160  -> overlaps a gate ending at 148   (hit)
 *   sliding body   152..160  -> clears it                       (safe)
 *   jumping        rises into the gate's column                 (hit)
 *
 * Extending it to the ceiling is what makes sliding the ONLY answer; a
 * floating block, however high, can simply be jumped over.
 */
const GATE_BOTTOM_Y = 148

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
  /** Set when a threat first appears, cleared when the player acts on it. */
  private threatSeenMs = 0

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
    this.threatSeenMs = 0

    this.cameras.main.setBackgroundColor('#120a1e')
    this.physics.world.setBounds(0, -80, VIEW_W, VIEW_H + 160)

    this.buildBackdrop()

    this.ground = this.add
      .tileSprite(VIEW_W / 2, GROUND_Y + TILE_SIZE, VIEW_W, TILE_SIZE * 2, ATLAS_KEY, 'tile-stone')
      .setDepth(DEPTH.Terrain)

    const dir = this.worldDir
    this.runner = this.physics.add
      .sprite(dir === 1 ? 64 : VIEW_W - 64, GROUND_Y - 8, ATLAS_KEY, 'player-idle')
      .setDepth(DEPTH.Player)
      .setFlipX(dir === -1)
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

    this.applyGround()
    this.handleJump(input)
    this.handleSlide(input, time)
    this.updateFrame()

    if (time >= this.nextSpawnMs) {
      this.spawnWave()
      this.nextSpawnMs = time + this.spawnIntervalMs(RUNNER_SPAWN_MS)
    }

    this.scrollEntities(delta)
  }

  protected teardownMode(): void {
    this.obstacles.length = 0
  }

  // --- construction ---------------------------------------------------------

  private buildBackdrop(): void {
    const g = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.Background)
    // Receding horizontal rules read as speed lines once things start moving.
    for (let i = 0; i < 14; i++) {
      const y = 20 + i * 9
      g.fillStyle(i % 2 === 0 ? 0xff3ea5 : 0x3ef0ff, 0.06 + i * 0.008)
      g.fillRect(0, y, VIEW_W, 1)
    }
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
    const progress = Math.min(1, (this.time.now - runState.stageStartMs) / total)
    this.scrollSpeed =
      (RUNNER_SCROLL_SPEED + (RUNNER_MAX_SCROLL_SPEED - RUNNER_SCROLL_SPEED) * progress) *
      this.mods.playerSpeedScale
  }

  private applyGround(): void {
    const body = this.runner.body as Phaser.Physics.Arcade.Body
    const feetY = GROUND_Y - 8
    if (this.runner.y >= feetY) {
      this.runner.y = feetY
      body.setVelocityY(0)
      if (!this.onGround) sfx.land()
      this.onGround = true
    } else {
      this.onGround = false
    }
  }

  private handleJump(input: InputState): void {
    if (!input.jumpJustPressed || !this.onGround) return
    if (this.time.now < this.slideUntilMs) return
    ;(this.runner.body as Phaser.Physics.Arcade.Body).setVelocityY(RUNNER_JUMP_VELOCITY)
    this.onGround = false
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
    const spawnX = dir === 1 ? VIEW_W + 20 : -20
    const kind: ObstacleKind = chance(this.rng, 0.5) ? OBSTACLE.Low : OBSTACLE.Gate
    const obs = kind === OBSTACLE.Low ? this.spawnBlock(spawnX) : this.spawnGate(spawnX)

    obs.setData('kind', kind)
    obs.setData('scored', false)
    this.obstacles.push(obs)

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
      ;(chip.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(8, 8).setOffset(4, 4)
    }
  }

  private spawnBlock(x: number): Phaser.GameObjects.Sprite {
    const obs = this.physics.add.sprite(x, GROUND_Y - 8, ATLAS_KEY, 'obstacle').setDepth(DEPTH.Enemy)
    ;(obs.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(14, 14).setOffset(1, 1)
    return obs
  }

  /** A hazard beam hanging from the ceiling. Rendered as a rectangle rather
   *  than stacked tiles: one body, one draw, and it reads as "duck". */
  private spawnGate(x: number): Phaser.GameObjects.Rectangle {
    const gate = this.add
      .rectangle(x, GATE_BOTTOM_Y / 2, 10, GATE_BOTTOM_Y, 0xff3ea5, 0.85)
      .setDepth(DEPTH.Enemy)
    gate.setStrokeStyle(1, 0xffe14d, 0.9)
    this.physics.add.existing(gate)
    ;(gate.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true)
    return gate
  }

  private scrollEntities(delta: number): void {
    const dx = -this.worldDir * this.scrollSpeed * (delta / 1000)
    const dir = this.worldDir

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i]
      obs.x += dx

      // Cleared it: score once, as it passes behind the runner.
      if (!obs.getData('scored') && (obs.x - this.runner.x) * dir < -10) {
        obs.setData('scored', true)
        this.award(SCORE_DODGE)
        this.rewardStreak()
      }

      if (dir === 1 ? obs.x < -24 : obs.x > VIEW_W + 24) {
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
