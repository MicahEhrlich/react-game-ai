import Phaser from 'phaser'
import { runState } from '../../state/runState.ts'
import type { GameMode } from '../../state/types.ts'
import { MODE } from '../../state/types.ts'
import { sfx } from '../audio.ts'
import {
  BALL_R,
  BRICK_H,
  BRICK_STALL_MS,
  BRICK_W,
  DEPTH,
  DMG_BALL_LOST,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  SCORE_BRICK,
  SCORE_WALL_CLEAR,
  VIEW_H,
  VIEW_W,
} from '../constants.ts'
import type { InputState } from '../input.ts'
import { makeRng } from '../rng.ts'
import type { Rng } from '../rng.ts'
import { MEME_SPRITE_ROLE } from '../../memeTheme/index.ts'
import {
  ballSpeedAt,
  clampMinVy,
  deflect,
  wallLayout,
} from '../brickPacing.ts'
import { ModeScene } from './ModeScene.ts'
import { SCENE } from './keys.ts'

type Brick = Phaser.Physics.Arcade.Sprite

/**
 * Mode D: BREAKDOWN, a DX-Ball / Breakout brick-breaker.
 */
export class BrickScene extends ModeScene {
  readonly modeId: GameMode = MODE.Brick

  // All reset at the top of setupMode().
  private paddle!: Phaser.GameObjects.Rectangle
  private ball!: Phaser.Physics.Arcade.Sprite
  private bricks!: Phaser.Physics.Arcade.StaticGroup
  private rng: Rng = makeRng(1)
  private lastUsefulHitMs = 0

  constructor() {
    super(SCENE.Brick)
  }

  protected override get fogAnchor(): Phaser.GameObjects.GameObject &
    Phaser.GameObjects.Components.Transform &
    Phaser.GameObjects.Components.Visible {
    return this.ball
  }

  protected setupMode(): void {
    this.rng = makeRng(Math.floor(Math.random() * 0xffffffff))
    this.lastUsefulHitMs = this.time.now

    // A shooter (or a stub) with the platformer's gravity still applied is
    // the exact bug per-scene physics config exists to prevent. BREAKDOWN
    // has no world gravity at all: gravityScale instead drives the ball's
    // speed ramp across the stage (see brickPacing.ballSpeedAt), the same
    // way SpaceShooterScene zeroes it here.
    this.physics.world.gravity.y = 0
    this.physics.world.setBounds(0, 0, VIEW_W, VIEW_H)

    // Distinct from the other three modes' backgrounds (#0d0a20, #070612,
    // #120a1e) and tinted toward the brick art's magenta accent.
    this.cameras.main.setBackgroundColor('#140a1c')
    this.buildBackdrop()
    this.add
      .text(VIEW_W / 2, 8, this.memeTheme.modeFlavor[this.modeId].brick, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '9px',
        color: this.memeTheme.palette[0] ?? '#3ef0ff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.Background)

    this.paddle = this.add
      .rectangle(VIEW_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, this.memeAccent(0, 0x3ef0ff), 1)
      .setStrokeStyle(1, this.memeAccent(2, 0xffffff), 0.75)
      .setDepth(DEPTH.Player)
    this.physics.add.existing(this.paddle)
    ;(this.paddle.body as Phaser.Physics.Arcade.Body)
      .setAllowGravity(false)
      .setImmovable(true)
      .setCollideWorldBounds(true)
      .setSize(PADDLE_W, PADDLE_H)
    this.avatar = this.paddle

    this.bricks = this.physics.add.staticGroup()
    this.buildWall()
    this.spawnBall()

    this.physics.add.collider(this.ball, this.paddle, () => this.onPaddleHit())
    this.physics.add.collider(this.ball, this.bricks, (_ball, brick) => {
      this.onBrickHit(brick as Brick)
    })
  }

  protected updateMode(input: InputState, time: number, _delta: number): void {
    const body = this.paddle.body as Phaser.Physics.Arcade.Body
    if (input.directTouch && input.aimX !== null) {
      const dx = input.aimX - this.paddle.x
      const deadZone = 4
      body.setVelocityX(Math.abs(dx) > deadZone ? Math.sign(dx) * this.playerSpeed(PADDLE_SPEED) : 0)
    } else {
      body.setVelocityX(input.dirX * this.playerSpeed(PADDLE_SPEED))
    }

    this.rampBallSpeed()
    this.handleBounds()
    this.keepBallReadable(time)

    if (this.ball.y > VIEW_H + BALL_R) {
      this.loseBall()
    }
  }

  protected teardownMode(): void {
    this.bricks?.clear(true, true)
  }

  private buildBackdrop(): void {
    const g = this.add.graphics().setDepth(DEPTH.Background).setScrollFactor(0)
    for (let y = 12; y < VIEW_H; y += 14) {
      g.fillStyle(y % 28 === 12 ? 0xff3ea5 : 0x3ef0ff, 0.07)
      g.fillRect(0, y, VIEW_W, 1)
    }
  }

  private buildWall(): void {
    this.bricks.clear(true, true)
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.Brick, 'brick')
    for (const spec of wallLayout(this.mods.spawnRateScale, this.mods.mirrorWorld, this.rng)) {
      const brick = this.bricks
        .create(spec.x, spec.y, sprite.key, sprite.frame)
        .setDepth(DEPTH.Terrain)
        .setScale(2, 1) as Brick
      brick.setTint(this.memeAccent(spec.row, 0xff3ea5))
      brick.setData('hp', spec.hits)
      brick.refreshBody()
      ;(brick.body as Phaser.Physics.Arcade.StaticBody).setSize(BRICK_W, BRICK_H).updateFromGameObject()
    }
  }

  private spawnBall(): void {
    this.ball?.destroy()
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.Ball, 'ball')
    this.ball = this.physics.add
      .sprite(this.paddle.x, PADDLE_Y - 18, sprite.key, sprite.frame)
      .setDepth(DEPTH.Projectile)
    this.ball.setTint(this.memeAccent(2, 0xffe14d))
    ;(this.ball.body as Phaser.Physics.Arcade.Body)
      .setAllowGravity(false)
      .setCircle(BALL_R, 8 - BALL_R, 8 - BALL_R)
      .setBounce(1, 1)
    this.launchBall(-1)
    this.lastUsefulHitMs = this.time.now
  }

  private launchBall(verticalSign: 1 | -1): void {
    const speed = this.currentBallSpeed()
    const dir = this.rng() < 0.5 ? -1 : 1
    const out = clampMinVy(dir * speed * 0.35, verticalSign * speed, speed)
    this.ball.setVelocity(out.vx, out.vy)
  }

  private onPaddleHit(): void {
    if (!this.ball.active) return
    const offset = (this.ball.x - this.paddle.x) / (PADDLE_W / 2)
    const out = deflect(offset, this.currentBallSpeed())
    this.ball.setY(PADDLE_Y - PADDLE_H / 2 - BALL_R - 0.5)
    this.ball.setVelocity(out.vx, out.vy)
    sfx.pickup()
    this.lastUsefulHitMs = this.time.now
  }

  private onBrickHit(brick: Brick): void {
    if (!brick.active) return

    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const out = clampMinVy(body.velocity.x, body.velocity.y, this.currentBallSpeed())
    this.ball.setVelocity(out.vx, out.vy)

    const hp = (brick.getData('hp') as number) - 1
    if (hp > 0) {
      brick.setData('hp', hp)
      const sprite = this.memeSprite(MEME_SPRITE_ROLE.BrickCracked, 'brick-cracked')
      brick.setTexture(sprite.key, sprite.frame)
      sfx.enemyShoot()
    } else {
      brick.destroy()
      this.award(SCORE_BRICK)
      this.rewardStreak()
      sfx.explode()
    }

    this.lastUsefulHitMs = this.time.now
    if (this.bricks.countActive(true) === 0) this.clearWall()
  }

  private clearWall(): void {
    this.award(SCORE_WALL_CLEAR)
    this.cameras.main.flash(90, 62, 240, 255)
    this.buildWall()
    this.launchBall(-1)
  }

  private loseBall(): void {
    if (!this.takeDamage(DMG_BALL_LOST)) return
    this.ball.setPosition(this.paddle.x, PADDLE_Y - 18)
    this.launchBall(-1)
  }

  private keepBallReadable(time: number): void {
    if (time - this.lastUsefulHitMs < BRICK_STALL_MS) return
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const towardWall: 1 | -1 = this.ball.y > VIEW_H / 2 ? -1 : 1
    const out = clampMinVy(body.velocity.x, towardWall * Math.abs(body.velocity.y), this.currentBallSpeed())
    this.ball.setVelocity(out.vx, out.vy)
    this.lastUsefulHitMs = time
  }

  private rampBallSpeed(): void {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const out = clampMinVy(body.velocity.x, body.velocity.y, this.currentBallSpeed())
    this.ball.setVelocity(out.vx, out.vy)
  }

  private handleBounds(): void {
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    let vx = body.velocity.x
    let vy = body.velocity.y

    if (this.ball.x <= BALL_R && vx < 0) {
      this.ball.setX(BALL_R)
      vx = Math.abs(vx)
    } else if (this.ball.x >= VIEW_W - BALL_R && vx > 0) {
      this.ball.setX(VIEW_W - BALL_R)
      vx = -Math.abs(vx)
    }

    if (this.ball.y <= BALL_R && vy < 0) {
      this.ball.setY(BALL_R)
      vy = Math.abs(vy)
    }

    if (vx !== body.velocity.x || vy !== body.velocity.y) {
      const out = clampMinVy(vx, vy, this.currentBallSpeed())
      this.ball.setVelocity(out.vx, out.vy)
    }
  }

  private currentBallSpeed(): number {
    const total = runState.stageDurationMs()
    const progress = (this.time.now - runState.stageStartMs) / total
    return ballSpeedAt(progress, this.mods.gravityScale, this.mods.projectileSpeedScale)
  }
}
