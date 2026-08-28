import Phaser from 'phaser'
import { ANIM } from '../art/anims.ts'
import { ATLAS_KEY } from '../art/atlas.ts'
import { FLYER_SPEED, WALKER_SPEED } from '../constants.ts'
import type { SpriteRef } from '../art/memeAtlas.ts'

/**
 * Ported from react-game. Note the invariant that came with them: these must
 * live in a plain array, never a physics Group -- Group#add() reapplies the
 * group's default body config to every member, including
 * `allowGravity: true`, which silently undoes Flyer's setAllowGravity(false).
 * `physics.add.overlap` accepts an array directly, so nothing is lost.
 */

/** Ground patrol: paces a fixed range around spawn, turning at walls. */
export class Walker extends Phaser.Physics.Arcade.Sprite {
  private readonly minX: number
  private readonly maxX: number
  private readonly speed: number
  private dir: 1 | -1 = -1

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rangePx: number,
    speedScale = 1,
    sprite: SpriteRef = { key: ATLAS_KEY, frame: 'walker-0' },
  ) {
    super(scene, x, y, sprite.key, sprite.frame)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    ;(this.body as Phaser.Physics.Arcade.Body).setSize(14, 14).setOffset(1, 1)

    this.minX = x - rangePx
    this.maxX = x + rangePx
    this.speed = WALKER_SPEED * speedScale
    if (sprite.key === ATLAS_KEY) this.anims.play(ANIM.Walker, true)
  }

  patrol(): void {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body.blocked.left || this.x <= this.minX) this.dir = 1
    else if (body.blocked.right || this.x >= this.maxX) this.dir = -1

    this.setVelocityX(this.speed * this.dir)
    this.setFlipX(this.dir > 0)
  }
}

/** Airborne patrol: ignores gravity, paces horizontally around spawn. */
export class Flyer extends Phaser.Physics.Arcade.Sprite {
  private readonly minX: number
  private readonly maxX: number
  private readonly speed: number
  private dir: 1 | -1 = -1

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rangePx: number,
    speedScale = 1,
    sprite: SpriteRef = { key: ATLAS_KEY, frame: 'flyer-0' },
  ) {
    super(scene, x, y, sprite.key, sprite.frame)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    ;(this.body as Phaser.Physics.Arcade.Body)
      .setAllowGravity(false)
      .setSize(14, 10)
      .setOffset(1, 3)

    this.minX = x - rangePx
    this.maxX = x + rangePx
    this.speed = FLYER_SPEED * speedScale
    if (sprite.key === ATLAS_KEY) this.anims.play(ANIM.Flyer, true)
  }

  patrol(): void {
    if (this.x <= this.minX) this.dir = 1
    else if (this.x >= this.maxX) this.dir = -1

    this.setVelocityX(this.speed * this.dir)
    this.setFlipX(this.dir > 0)
  }
}
