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
  BRICK_WALL_TOP_Y,
  DEPTH,
  DMG_BALL_LOST,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  SCORE_BRICK,
  SCORE_WALL_CLEAR,
  VIEW_H,
  VIEW_W,
} from '../constants.ts'
import type { InputState } from '../input.ts'
import { makeRng } from '../rng.ts'
import type { Rng } from '../rng.ts'
import { MEME_SPRITE_ROLE } from '../../memeTheme/index.ts'
import { brickTouchDirX } from '../touchSteering.ts'
import {
  ballSpeedAt,
  ballLost,
  ballSpawnY,
  brickPaddleY,
  brickPlayDir,
  clampMinVy,
  deflectForOrientation,
  brickRows,
  orientedBrickY,
  paddleHitY,
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
  private brickLabels: Phaser.GameObjects.Text[] = []
  private paddleCostume?: Phaser.GameObjects.Graphics
  private rng: Rng = makeRng(1)
  private lastUsefulHitMs = 0
  private paddleY = 0

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
    this.brickLabels = []
    this.paddleCostume = undefined
    this.paddleY = brickPaddleY(this.mods.mirrorWorld)
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
      .rectangle(VIEW_W / 2, this.paddleY, PADDLE_W, PADDLE_H, this.memeAccent(0, 0x3ef0ff), 1)
      .setStrokeStyle(1, this.memeAccent(2, 0xffffff), 0.75)
      .setDepth(DEPTH.Player)
    if (this.memeTheme.id === 'maga-rally' || this.memeTheme.id === 'kirk-mode') {
      this.paddleCostume = this.add.graphics().setDepth(DEPTH.Player + 1)
    }
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
      body.setVelocityX(brickTouchDirX(input.aimX, this.paddle.x) * this.playerSpeed(PADDLE_SPEED))
    } else {
      body.setVelocityX(input.dirX * this.playerSpeed(PADDLE_SPEED))
    }

    this.rampBallSpeed()
    this.handleBounds()
    this.keepBallReadable(time)
    this.updatePaddleCostume()

    if (ballLost(this.ball.y, this.mods.mirrorWorld)) {
      this.loseBall()
    }
  }

  protected teardownMode(): void {
    this.bricks?.clear(true, true)
    this.clearBrickLabels()
    this.paddleCostume?.destroy()
    this.paddleCostume = undefined
    this.ball?.destroy()
  }

  private buildBackdrop(): void {
    if (this.memeTheme.id === 'tabloid-island') {
      this.buildIslandBackdrop()
      return
    }
    const g = this.add.graphics().setDepth(DEPTH.Background).setScrollFactor(0)
    if (this.memeTheme.id === 'maga-rally') {
      this.drawMagaBorderBackdrop(g)
    }
    for (let y = 12; y < VIEW_H; y += 14) {
      g.fillStyle(y % 28 === 12 ? 0xff3ea5 : 0x3ef0ff, 0.07)
      g.fillRect(0, y, VIEW_W, 1)
    }
  }

  private drawMagaBorderBackdrop(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x1c2f8c, 0.3)
    g.fillRect(0, 0, VIEW_W, BRICK_WALL_TOP_Y + BRICK_H * 2)
    g.fillStyle(0xf2eeff, 0.28)
    for (let y = 10; y < BRICK_WALL_TOP_Y + BRICK_H * 2; y += 10) {
      g.fillRect(0, y, VIEW_W, 3)
    }
    g.fillStyle(0xf2eeff, 0.55)
    for (let x = 8; x < 72; x += 12) {
      g.fillCircle(x, 9 + (x % 3) * 4, 2)
    }

    const bottomY = this.wallBottomY() + 10
    const stripeW = VIEW_W / 3
    g.fillStyle(0x1c7a4a, 0.3)
    g.fillRect(0, bottomY, stripeW, VIEW_H - bottomY)
    g.fillStyle(0xf2eeff, 0.24)
    g.fillRect(stripeW, bottomY, stripeW, VIEW_H - bottomY)
    g.fillStyle(0xff4d4d, 0.3)
    g.fillRect(stripeW * 2, bottomY, stripeW, VIEW_H - bottomY)
    g.fillStyle(0xff9a2e, 0.45)
    g.fillCircle(VIEW_W / 2, bottomY + 26, 8)
  }

  private buildIslandBackdrop(): void {
    const g = this.add.graphics().setDepth(DEPTH.Background).setScrollFactor(0)
    g.fillStyle(0x071a2a, 0.95)
    g.fillRect(0, 0, VIEW_W, VIEW_H)
    g.fillStyle(0x18b8c8, 0.36)
    g.fillRect(0, VIEW_H - 74, VIEW_W, 74)
    g.fillStyle(0x4de8ff, 0.18)
    for (let y = VIEW_H - 65; y < VIEW_H; y += 11) g.fillRect(0, y, VIEW_W, 2)

    const islandX = VIEW_W / 2
    const islandY = VIEW_H - 34
    g.fillStyle(0xffe14d, 0.58)
    g.fillEllipse(islandX, islandY, VIEW_W * 0.86, 38)
    g.fillStyle(0x1c7a4a, 0.72)
    g.fillEllipse(islandX - 3, islandY - 9, VIEW_W * 0.72, 24)
    g.fillStyle(0x0f5d35, 0.45)
    g.fillEllipse(islandX - 45, islandY - 14, 74, 18)
    g.fillEllipse(islandX + 56, islandY - 12, 86, 18)

    const villaX = islandX - 66
    const villaY = VIEW_H - 111
    g.fillStyle(0xf2eeff, 0.72)
    g.fillRect(villaX, villaY + 20, 132, 48)
    g.fillStyle(0xded8d2, 0.82)
    g.fillTriangle(villaX - 10, villaY + 20, villaX + 34, villaY, villaX + 78, villaY + 20)
    g.fillTriangle(villaX + 52, villaY + 20, villaX + 96, villaY + 2, villaX + 142, villaY + 20)
    g.fillStyle(0xf2eeff, 0.62)
    g.fillRect(villaX + 86, villaY + 32, 52, 36)
    g.fillStyle(0xded8d2, 0.8)
    g.fillTriangle(villaX + 78, villaY + 32, villaX + 112, villaY + 14, villaX + 148, villaY + 32)
    g.fillStyle(0x105f8f, 0.66)
    for (let x = villaX + 12; x < villaX + 116; x += 24) g.fillRect(x, villaY + 31, 14, 18)
    g.fillStyle(0x18b8c8, 0.48)
    g.fillRect(villaX + 20, villaY + 75, 92, 12)
    g.fillStyle(0xf2eeff, 0.46)
    g.fillRect(villaX + 14, villaY + 70, 104, 4)

    for (const x of [islandX - 104, islandX + 101]) {
      g.fillStyle(0xffc9a0, 0.74)
      g.fillRect(x - 3, VIEW_H - 86, 6, 46)
      g.fillStyle(0x1c7a4a, 0.88)
      g.fillEllipse(x - 22, VIEW_H - 91, 38, 12)
      g.fillEllipse(x, VIEW_H - 102, 44, 13)
      g.fillEllipse(x + 23, VIEW_H - 91, 38, 12)
      g.fillEllipse(x + 4, VIEW_H - 81, 36, 11)
      g.fillStyle(0xff9a2e, 0.9)
      g.fillCircle(x - 6, VIEW_H - 90, 2)
      g.fillCircle(x + 3, VIEW_H - 88, 2)
    }
  }

  private buildWall(): void {
    this.bricks.clear(true, true)
    this.clearBrickLabels()
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.Brick, 'brick')
    for (const spec of wallLayout(this.mods.spawnRateScale, this.mods.mirrorWorld, this.rng)) {
      const brick = this.bricks
        .create(spec.x, orientedBrickY(spec.y, this.mods.mirrorWorld), sprite.key, sprite.frame)
        .setDepth(DEPTH.Terrain)
        .setScale(2, 1) as Brick
      brick.setTint(this.brickTint(spec.x, spec.row))
      if ((spec.col === 0 || spec.col === 6) && this.memeTheme.id !== 'maga-rally') {
        const label = this.add
          .text(spec.x, orientedBrickY(spec.y, this.mods.mirrorWorld), this.brickStamp(spec.row), {
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
            fontSize: '8px',
            color: this.memeTheme.palette[(spec.row + 1) % this.memeTheme.palette.length] ?? '#ffffff',
          })
          .setOrigin(0.5)
          .setDepth(DEPTH.Terrain + 1)
          .setAlpha(0.86)
        this.brickLabels.push(label)
      }
      brick.setData('hp', spec.hits)
      brick.refreshBody()
      ;(brick.body as Phaser.Physics.Arcade.StaticBody).setSize(BRICK_W, BRICK_H).updateFromGameObject()
    }
  }

  private clearBrickLabels(): void {
    for (const label of this.brickLabels) label.destroy()
    this.brickLabels = []
  }

  private spawnBall(): void {
    this.ball?.destroy()
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.Ball, 'ball')
    this.ball = this.physics.add
      .sprite(this.paddle.x, ballSpawnY(this.mods.mirrorWorld), sprite.key, sprite.frame)
      .setDepth(DEPTH.Projectile)
    this.ball.setTint(this.memeAccent(2, 0xffe14d))
    ;(this.ball.body as Phaser.Physics.Arcade.Body)
      .setAllowGravity(false)
      .setCircle(BALL_R, 8 - BALL_R, 8 - BALL_R)
      .setBounce(1, 1)
    this.launchBall(brickPlayDir(this.mods.mirrorWorld))
    this.lastUsefulHitMs = this.time.now
  }

  private brickStamp(row: number): string {
    if (this.memeTheme.id === 'six-seven') return row % 2 === 0 ? '6' : '7'
    if (this.memeTheme.id === 'maga-rally') return row % 2 === 0 ? 'USA' : 'MEX'
    if (this.memeTheme.id === 'npc-stream') return row % 2 === 0 ? 'NPC' : 'LOOP'
    if (this.memeTheme.id === 'rizz-circuit') return row % 2 === 0 ? 'AURA' : 'RIZZ'
    return this.memeTheme.modeFlavor[this.modeId].brick.slice(0, 4)
  }

  private brickTint(x: number, row: number): number {
    if (this.memeTheme.id !== 'maga-rally') return this.memeAccent(row, 0xff3ea5)
    void x
    return row % 2 === 0 ? 0x8f88b8 : 0xf2eeff
  }

  private updatePaddleCostume(): void {
    const g = this.paddleCostume
    if (!g) return
    g.clear()
    const x = this.paddle.x
    const y = this.paddle.y
    if (this.memeTheme.id === 'kirk-mode') {
      g.lineStyle(1, 0x08060f, 1)
      g.fillStyle(0xffc9a0, 1)
      g.fillRect(x - 5, y - 14, 10, 8)
      g.strokeRect(x - 5, y - 14, 10, 8)
      g.fillStyle(0x3b2318, 1)
      g.fillRect(x - 5, y - 16, 10, 2)
      g.fillRect(x - 3, y - 18, 8, 2)
      g.fillStyle(0x08060f, 1)
      g.fillRect(x - 1, y - 10, 1, 1)
      g.fillRect(x + 1, y - 10, 1, 1)
      g.fillRect(x - 1, y - 7, 4, 1)
      return
    }
    g.lineStyle(1, 0x08060f, 1)
    g.fillStyle(0xffc9a0, 1)
    g.fillRect(x - 5, y - 14, 10, 8)
    g.strokeRect(x - 5, y - 14, 10, 8)
    g.fillStyle(0x08060f, 1)
    g.fillRect(x - 3, y - 10, 2, 1)
    g.fillRect(x + 2, y - 10, 2, 1)
    g.fillRect(x + 1, y - 7, 5, 1)
    g.fillStyle(0xff9a2e, 1)
    g.fillRect(x - 6, y - 17, 11, 3)
    g.fillRect(x - 7, y - 15, 3, 6)
    g.fillRect(x + 3, y - 16, 5, 2)
    g.fillRect(x + 7, y - 18, 2, 4)
    g.fillStyle(0xffe14d, 0.85)
    g.fillRect(x - 5, y - 17, 8, 1)
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
    const out = deflectForOrientation(offset, this.currentBallSpeed(), this.mods.mirrorWorld)
    this.ball.setY(paddleHitY(this.mods.mirrorWorld))
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
    this.launchBall(brickPlayDir(this.mods.mirrorWorld))
  }

  private loseBall(): void {
    if (!this.takeDamage(DMG_BALL_LOST)) return
    this.ball.setPosition(this.paddle.x, ballSpawnY(this.mods.mirrorWorld))
    this.launchBall(brickPlayDir(this.mods.mirrorWorld))
  }

  private keepBallReadable(time: number): void {
    if (time - this.lastUsefulHitMs < BRICK_STALL_MS) return
    const body = this.ball.body as Phaser.Physics.Arcade.Body
    const towardWall = brickPlayDir(this.mods.mirrorWorld)
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

    if (!this.mods.mirrorWorld && this.ball.y <= BALL_R && vy < 0) {
      this.ball.setY(BALL_R)
      vy = Math.abs(vy)
    } else if (this.mods.mirrorWorld && this.ball.y >= VIEW_H - BALL_R && vy > 0) {
      this.ball.setY(VIEW_H - BALL_R)
      vy = -Math.abs(vy)
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

  private wallBottomY(): number {
    const rows = brickRows(this.mods.spawnRateScale)
    const normalBottom = BRICK_WALL_TOP_Y + (rows - 1) * BRICK_H + BRICK_H / 2
    return this.mods.mirrorWorld ? orientedBrickY(BRICK_WALL_TOP_Y, true) + BRICK_H / 2 : normalBottom
  }
}
