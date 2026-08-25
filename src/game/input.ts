import Phaser from 'phaser'
import { runState } from '../state/runState.ts'
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
export interface InputState {
  readonly dirX: -1 | 0 | 1
  readonly dirY: -1 | 0 | 1
  readonly actionHeld: boolean
  readonly actionJustPressed: boolean
  readonly jumpHeld: boolean
  readonly jumpJustPressed: boolean
  readonly slideHeld: boolean
}

export const NEUTRAL_INPUT: InputState = {
  dirX: 0,
  dirY: 0,
  actionHeld: false,
  actionJustPressed: false,
  jumpHeld: false,
  jumpJustPressed: false,
  slideHeld: false,
}

function axis(neg: boolean, pos: boolean): -1 | 0 | 1 {
  if (neg && !pos) return -1
  if (pos && !neg) return 1
  return 0
}

/** Merges keyboard + touch and applies the invertControls modifier. */
export class InputReader {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private readonly keyA: Phaser.Input.Keyboard.Key
  private readonly keyD: Phaser.Input.Keyboard.Key
  private readonly keyW: Phaser.Input.Keyboard.Key
  private readonly keyS: Phaser.Input.Keyboard.Key

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard
    if (!kb) throw new Error('Keyboard plugin unavailable')
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

    const jumpHeld = up || this.cursors.space.isDown || t.action
    const jumpJustPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      touch.consumeJumpEdge()

    const actionHeld = this.cursors.space.isDown || this.cursors.shift.isDown || t.action
    const actionJustPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.shift)

    let dirX = axis(left, right)
    let dirY = axis(up, down)

    // Applied here and nowhere else, so no mode can forget to honour it.
    if (runState.modifiers.invertControls) {
      dirX = -dirX as -1 | 0 | 1
      dirY = -dirY as -1 | 0 | 1
    }

    return {
      dirX,
      dirY,
      actionHeld,
      actionJustPressed,
      jumpHeld,
      jumpJustPressed,
      slideHeld: down || t.slide,
    }
  }
}
