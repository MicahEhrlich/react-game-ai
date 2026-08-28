import Phaser from 'phaser'
import { metrics } from '../../state/metrics.ts'
import type { GameMode } from '../../state/types.ts'
import { MODE } from '../../state/types.ts'
import { ANIM } from '../art/anims.ts'
import { ATLAS_KEY } from '../art/atlas.ts'
import { sfx } from '../audio.ts'
import {
  DEPTH,
  DMG_ENEMY,
  DMG_PROJECTILE,
  ENEMY_SHOT_SPEED,
  SCORE_KILL,
  SCORE_PICKUP,
  SHIP_SPEED,
  SHOOTER_SPAWN_MS,
  SHOT_COOLDOWN_MS,
  SHOT_SPEED,
  VIEW_H,
  VIEW_W,
} from '../constants.ts'
import type { InputState } from '../input.ts'
import { MEME_SPRITE_ROLE } from '../../memeTheme/index.ts'
import { shooterTouchDir } from '../touchSteering.ts'
import { chance, makeRng, randInt } from '../rng.ts'
import type { Rng } from '../rng.ts'
import { ModeScene } from './ModeScene.ts'
import { SCENE } from './keys.ts'

/**
 * Mode B: side-scrolling shooter. The player holds a lane-free 2D position on
 * one side of the screen and fires across it; gunships stream in from the
 * other side.
 *
 * `worldDir` (the mirrorWorld modifier) flips which side is which -- the
 * player, the enemy entry edge, and every projectile direction all derive
 * from it, so mirroring is a genuinely different stage rather than a
 * reversed picture.
 */
export class SpaceShooterScene extends ModeScene {
  readonly modeId: GameMode = MODE.Shooter

  // All reset at the top of setupMode().
  private ship!: Phaser.Physics.Arcade.Sprite
  private shots!: Phaser.Physics.Arcade.Group
  private enemyShots!: Phaser.Physics.Arcade.Group
  private enemies: Phaser.Physics.Arcade.Sprite[] = []
  private rng: Rng = makeRng(1)
  private lastShotMs = 0
  private nextSpawnMs = 0
  private nextEnemyFireMs = 0
  private stars!: Phaser.GameObjects.Graphics

  constructor() {
    super(SCENE.Shooter)
  }

  protected setupMode(): void {
    this.enemies = []
    this.rng = makeRng(Math.floor(Math.random() * 0xffffffff))
    this.lastShotMs = 0
    this.nextSpawnMs = 0
    this.nextEnemyFireMs = 0

    // A shooter with the platformer's gravity still applied is the exact bug
    // per-scene physics config exists to prevent.
    this.physics.world.gravity.y = 0
    this.physics.world.setBounds(0, 0, VIEW_W, VIEW_H)

    this.cameras.main.setBackgroundColor('#070612')
    this.buildStarfield()

    const dir = this.worldDir
    this.ship = this.physics.add
      .sprite(dir === 1 ? 40 : VIEW_W - 40, VIEW_H / 2, ATLAS_KEY, 'ship-0')
      .setDepth(DEPTH.Player)
      .setFlipX(dir === -1)
    this.ship.anims.play(ANIM.Ship, true)
    ;(this.ship.body as Phaser.Physics.Arcade.Body)
      .setSize(12, 8)
      .setOffset(2, 4)
      .setCollideWorldBounds(true)
    this.avatar = this.ship

    this.shots = this.physics.add.group()
    this.enemyShots = this.physics.add.group()

    this.physics.add.overlap(this.shots, this.enemies, (shot, enemy) => {
      this.onShotHit(
        shot as Phaser.Physics.Arcade.Sprite,
        enemy as Phaser.Physics.Arcade.Sprite,
      )
    })
    this.physics.add.overlap(this.ship, this.enemyShots, (_s, bolt) => {
      if (this.takeDamage(DMG_PROJECTILE)) (bolt as Phaser.GameObjects.Sprite).destroy()
    })
    this.physics.add.overlap(this.ship, this.enemies, (_s, enemy) => {
      if (this.takeDamage(DMG_ENEMY)) this.killEnemy(enemy as Phaser.Physics.Arcade.Sprite, false)
    })
  }

  protected updateMode(input: InputState, time: number, _delta: number): void {
    const speed = this.playerSpeed(SHIP_SPEED)
    if (input.directTouch && input.aimX !== null && input.aimY !== null) {
      const dir = shooterTouchDir(input.aimX, input.aimY, this.ship.x, this.ship.y)
      this.ship.setVelocity(dir.dirX * speed, dir.dirY * speed)
    } else {
      this.ship.setVelocity(input.dirX * speed, input.dirY * speed)
    }

    // gravityScale has no gravity to scale here, so the shooter reads it as a
    // constant downward drift -- the modifier still means "the world pulls on
    // you", which is what keeps the vocabulary mode-agnostic.
    if (this.mods.gravityScale !== 1) {
      const body = this.ship.body as Phaser.Physics.Arcade.Body
      this.ship.setVelocityY(body.velocity.y + (this.mods.gravityScale - 1) * 60)
    }

    if (input.actionHeld && time - this.lastShotMs >= SHOT_COOLDOWN_MS) {
      this.fire(time)
    }

    if (time >= this.nextSpawnMs) {
      this.spawnEnemy()
      this.nextSpawnMs = time + this.spawnIntervalMs(SHOOTER_SPAWN_MS)
    }

    if (time >= this.nextEnemyFireMs) {
      this.enemyFire()
      this.nextEnemyFireMs = time + this.spawnIntervalMs(1400)
    }

    this.cullOffscreen()
    this.stars.x = (this.stars.x - this.worldDir * 0.4) % VIEW_W
  }

  protected teardownMode(): void {
    this.enemies.length = 0
  }

  // --- construction --------------------------------------------------------

  private buildStarfield(): void {
    this.stars = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.Background)
    for (let i = 0; i < 120; i++) {
      const shade = [0x3ef0ff, 0xff3ea5, 0x8f88b8][i % 3]
      this.stars.fillStyle(shade, 0.2 + Math.random() * 0.4)
      // Drawn across two screen widths so the horizontal wrap has no seam.
      this.stars.fillRect(Math.random() * VIEW_W * 2, Math.random() * VIEW_H, 1, 1)
    }
  }

  // --- combat ---------------------------------------------------------------

  private fire(time: number): void {
    this.lastShotMs = time
    const dir = this.worldDir
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.ShooterProjectile, 'shot-player')
    const bolt = this.shots.create(
      this.ship.x + dir * 10,
      this.ship.y,
      sprite.key,
      sprite.frame,
    ) as Phaser.Physics.Arcade.Sprite
    bolt.setDepth(DEPTH.Projectile)
    bolt.setTint(this.memeAccent(0, 0x3ef0ff))
    bolt.setVelocityX(dir * this.projectileSpeed(SHOT_SPEED))
    ;(bolt.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(10, 4).setOffset(3, 6)
    this.addMemeTrail(bolt.x - dir * 13, bolt.y - 6, this.memeTheme.modeFlavor[this.modeId].projectile, 0)
    sfx.shoot()
    metrics.shotFired()
  }

  private spawnEnemy(): void {
    const dir = this.worldDir
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.ShooterEnemy, 'gunship-0')
    const enemy = this.physics.add
      .sprite(
        dir === 1 ? VIEW_W + 12 : -12,
        randInt(this.rng, 20, VIEW_H - 20),
        sprite.key,
        sprite.frame,
      )
      .setDepth(DEPTH.Enemy)
      .setFlipX(dir === -1)
    enemy.setTint(this.memeAccent(1, 0xff3ea5))
    this.addMemeTrail(enemy.x - dir * 16, enemy.y - 13, this.memeTheme.modeFlavor[this.modeId].enemy, 1)
    if (sprite.key === ATLAS_KEY) enemy.anims.play(ANIM.Gunship, true)
    ;(enemy.body as Phaser.Physics.Arcade.Body)
      .setAllowGravity(false)
      .setSize(14, 10)
      .setOffset(1, 3)

    const speed = this.projectileSpeed(randInt(this.rng, 45, 80))
    enemy.setVelocityX(-dir * speed)
    // A slow vertical weave makes them meaningfully harder to line up than a
    // straight drift, without needing real AI.
    enemy.setVelocityY(chance(this.rng, 0.5) ? randInt(this.rng, -25, 25) : 0)
    enemy.setData('hp', 1)

    this.enemies.push(enemy)
  }

  private enemyFire(): void {
    const live = this.enemies.filter((e) => e.active && e.x > 0 && e.x < VIEW_W)
    if (live.length === 0) return
    const shooter = live[Math.floor(this.rng() * live.length)]
    const dir = this.worldDir
    const sprite = this.memeSprite(MEME_SPRITE_ROLE.ShooterProjectile, 'shot-enemy')

    const bolt = this.enemyShots.create(
      shooter.x - dir * 10,
      shooter.y,
      sprite.key,
      sprite.frame,
    ) as Phaser.Physics.Arcade.Sprite
    bolt.setDepth(DEPTH.Projectile)
    bolt.setTint(this.memeAccent(2, 0xffe14d))
    bolt.setVelocityX(-dir * this.projectileSpeed(ENEMY_SHOT_SPEED))
    ;(bolt.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(6, 6).setOffset(5, 5)
    this.addMemeTrail(bolt.x + dir * 11, bolt.y - 6, this.memeTheme.modeFlavor[this.modeId].projectile, 2)
    sfx.enemyShoot()
  }

  private addMemeTrail(x: number, y: number, label: string, paletteIndex: number): void {
    const txt = this.add
      .text(x, y, label, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '7px',
        color: this.memeTheme.palette[paletteIndex % this.memeTheme.palette.length] ?? '#3ef0ff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.Background)
      .setAlpha(0.85)
    this.tweens.add({ targets: txt, alpha: 0, y: y - 6, duration: 900, onComplete: () => txt.destroy() })
  }

  private onShotHit(
    shot: Phaser.Physics.Arcade.Sprite,
    enemy: Phaser.Physics.Arcade.Sprite,
  ): void {
    if (!shot.active || !enemy.active) return
    shot.destroy()
    metrics.shotHit()
    this.killEnemy(enemy, true)
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite, scored: boolean): void {
    if (!enemy.active) return
    enemy.destroy()
    this.removeEnemy(enemy)
    sfx.explode()
    if (scored) {
      this.award(SCORE_KILL)
      this.rewardStreak()
    }
  }

  /**
   * Anything that leaves the view is destroyed rather than left drifting --
   * a stage runs up to 30s and a shooter can otherwise accumulate plenty of
   * dead bodies with live physics.
   */
  private cullOffscreen(): void {
    const margin = 24
    for (const group of [this.shots, this.enemyShots]) {
      for (const obj of group.getChildren()) {
        const s = obj as Phaser.Physics.Arcade.Sprite
        if (s.x < -margin || s.x > VIEW_W + margin) s.destroy()
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy.x < -margin || enemy.x > VIEW_W + margin) {
        enemy.destroy()
        // Surviving a pass is worth something, so ignoring enemies is a real
        // (if poorer) strategy rather than free.
        this.award(SCORE_PICKUP / 4)
      }
      if (!enemy.active) this.enemies.splice(i, 1)
    }
  }

  /**
   * In-place removal, never `this.enemies = filter(...)`. physics.add.overlap
   * captured a reference to THIS array object at setup; reassigning the field
   * leaves the collider pointing at a stale array, and every shot silently
   * stops hitting anything.
   */
  private removeEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const i = this.enemies.indexOf(enemy)
    if (i >= 0) this.enemies.splice(i, 1)
  }
}
