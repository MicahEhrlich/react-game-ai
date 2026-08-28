import Phaser from 'phaser'
import type { StageModifiers } from '../director/types.ts'
import type { GameMode } from '../state/types.ts'
import { mapInputForMode, NEUTRAL_INPUT } from './inputMapping.ts'
import type { InputState, RawInputState } from './inputMapping.ts'
import { touch } from './touch.ts'

/**
 * One input vocabulary for all three modes. Each mode reads the fields it
 * cares about:
 *
 *   platformer  dirX, jumpJustPressed, jumpHeld
 *   shooter     dirX, dirY, actionHeld
 *   runner      dirX (lane change), jumpJustPressed, slideHeld
 *
 * Keeping it unified is what lets ModeScene own input entirely, so a new mode
 * never re-derives "what counts as jump".
 */
export { mapInputForMode, NEUTRAL_INPUT }
export type { InputState, RawInputState }

/** Merges keyboard + touch and applies the invertControls modifier. */
export class InputReader {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private readonly keyA: Phaser.Input.Keyboard.Key
  private readonly keyD: Phaser.Input.Keyboard.Key
  private readonly keyW: Phaser.Input.Keyboard.Key
  private readonly keyS: Phaser.Input.Keyboard.Key
  /**
   * The modifiers this SCENE was built with, not the live runState. The
   * orchestrator commits the next stage's modifiers before the outgoing scene
   * has finished stopping, so reading globally would flip a dying scene's
   * controls for a frame. Every other modifier already goes through the
   * ModeScene snapshot; this one now does too.
   */
  private readonly mods: StageModifiers
  private readonly modeId: GameMode

  constructor(scene: Phaser.Scene, mods: StageModifiers, modeId: GameMode) {
    const kb = scene.input.keyboard
    if (!kb) throw new Error('Keyboard plugin unavailable')
    this.mods = mods
    this.modeId = modeId
    this.cursors = kb.createCursorKeys()
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S)
  }

  read(): InputState {
    const t = touch.state

    const left = this.cursors.left.isDown || this.keyA.isDown || t.dirX === -1
    const right = this.cursors.right.isDown || this.keyD.isDown || t.dirX === 1
    const up = this.cursors.up.isDown || this.keyW.isDown || t.dirY === -1
    const down = this.cursors.down.isDown || this.keyS.isDown || t.dirY === 1

    const jumpHeld = up || this.cursors.space.isDown || t.action || t.jumpHeld
    const jumpJustPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      touch.consumeJumpEdge()
    const slideJustPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.down) ||
      Phaser.Input.Keyboard.JustDown(this.keyS) ||
      touch.consumeSlideEdge()

    const actionHeld = this.cursors.space.isDown || this.cursors.shift.isDown || t.action
    const actionJustPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.shift)

    return mapInputForMode(
      {
        left,
        right,
        up,
        down,
        jumpHeld,
        jumpJustPressed,
        slideHeld: down || t.slide,
        slideJustPressed,
        actionHeld,
        actionJustPressed,
      },
      this.modeId,
      this.mods,
    )
  }
}
