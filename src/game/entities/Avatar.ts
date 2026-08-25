import Phaser from 'phaser'
import { ANIM } from '../art/anims.ts'
import { ATLAS_KEY } from '../art/atlas.ts'
import { sfx } from '../audio.ts'
import {
  ACCEL_AIR,
  ACCEL_GROUND,
  COYOTE_MS,
  DRAG_AIR,
  DRAG_GROUND,
  JUMP_BUFFER_MS,
  JUMP_CUT_VELOCITY,
  JUMP_VELOCITY,
  MAX_FALL_SPEED,
  PLAYER_BODY_H,
  PLAYER_BODY_OFF_X,
  PLAYER_BODY_OFF_Y,
  PLAYER_BODY_W,
  RUN_SPEED_MAX,
} from '../constants.ts'
import type { InputState } from '../input.ts'
import { metrics } from '../../state/metrics.ts'

/**
 * The platformer avatar: coyote time, jump buffering, variable jump height,
 * and a ground/air accel-drag split. Ported from react-game's Player, with
 * invulnerability lifted out -- ModeScene owns i-frames and the blink now, so
 * all three modes share one damage model.
 */
export class Avatar extends Phaser.Physics.Arcade.Sprite {
  private coyoteMs = 0
  private bufferMs = 0
  private jumping = false
  /** playerSpeedScale from the active StageModifiers. Declared explicitly
   *  rather than as a parameter property: `erasableSyntaxOnly` bans those. */
  private readonly speedScale: number

  constructor(scene: Phaser.Scene, x: number, y: number, speedScale: number) {
    super(scene, x, y, ATLAS_KEY, 'player-idle')
    this.speedScale = speedScale
    scene.add.existing(this)
    scene.physics.add.existing(this)

    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(PLAYER_BODY_W, PLAYER_BODY_H)
    body.setOffset(PLAYER_BODY_OFF_X, PLAYER_BODY_OFF_Y)
    body.setMaxVelocity(RUN_SPEED_MAX * speedScale, MAX_FALL_SPEED)
  }

  drive(input: InputState, deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down

    // Coyote time: still jumpable for a short window after walking off a ledge.
    this.coyoteMs = onGround ? COYOTE_MS : this.coyoteMs - deltaMs
    // Jump buffering: a press just before landing still triggers a jump.
    this.bufferMs = input.jumpJustPressed ? JUMP_BUFFER_MS : this.bufferMs - deltaMs

    const accel = (onGround ? ACCEL_GROUND : ACCEL_AIR) * this.speedScale
    body.setDragX(onGround ? DRAG_GROUND : DRAG_AIR)
    body.setAccelerationX(input.dirX * accel)

    if (input.dirX !== 0) this.setFlipX(input.dirX < 0)

    if (this.bufferMs > 0 && this.coyoteMs > 0) {
      body.setVelocityY(JUMP_VELOCITY)
      this.bufferMs = 0
      this.coyoteMs = 0
      this.jumping = true
      sfx.jump()
      metrics.jumped()
    }

    // Variable jump height: releasing early cuts the ascent short.
    if (this.jumping && !input.jumpHeld && body.velocity.y < JUMP_CUT_VELOCITY) {
      body.setVelocityY(JUMP_CUT_VELOCITY)
      this.jumping = false
    }
    if (onGround) this.jumping = false

    this.updateAnimation(onGround, input.dirX, body.velocity.y)
  }

  private updateAnimation(onGround: boolean, dirX: number, velocityY: number): void {
    if (!onGround) {
      this.anims.stop()
      this.setFrame(velocityY < 0 ? 'player-jump' : 'player-fall')
    } else if (dirX !== 0) {
      this.anims.play(ANIM.Walk, true)
    } else {
      this.anims.stop()
      this.setFrame('player-idle')
    }
  }
}
