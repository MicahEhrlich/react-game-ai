import type { StageModifiers } from '../director/types.ts'
import { MODE } from '../state/types.ts'
import type { GameMode } from '../state/types.ts'

export interface InputState {
  readonly dirX: -1 | 0 | 1
  readonly dirY: -1 | 0 | 1
  readonly aimX: number | null
  readonly aimY: number | null
  readonly directTouch: boolean
  readonly actionHeld: boolean
  readonly actionJustPressed: boolean
  readonly jumpHeld: boolean
  readonly jumpJustPressed: boolean
  readonly slideHeld: boolean
}

export const NEUTRAL_INPUT: InputState = {
  dirX: 0,
  dirY: 0,
  aimX: null,
  aimY: null,
  directTouch: false,
  actionHeld: false,
  actionJustPressed: false,
  jumpHeld: false,
  jumpJustPressed: false,
  slideHeld: false,
}

export interface RawInputState {
  readonly left: boolean
  readonly right: boolean
  readonly up: boolean
  readonly down: boolean
  readonly jumpHeld: boolean
  readonly jumpJustPressed: boolean
  readonly slideHeld: boolean
  readonly slideJustPressed: boolean
  readonly actionHeld: boolean
  readonly actionJustPressed: boolean
  readonly aimX: number | null
  readonly aimY: number | null
  readonly directTouch: boolean
}

function axis(neg: boolean, pos: boolean): -1 | 0 | 1 {
  if (neg && !pos) return -1
  if (pos && !neg) return 1
  return 0
}

export function mapInputForMode(
  raw: RawInputState,
  modeId: GameMode,
  mods: Pick<StageModifiers, 'invertControls'>,
): InputState {
  let dirX = axis(raw.left, raw.right)
  let dirY = axis(raw.up, raw.down)
  let jumpHeld = raw.jumpHeld
  let jumpJustPressed = raw.jumpJustPressed
  let slideHeld = raw.slideHeld
  let actionHeld = raw.actionHeld

  if (mods.invertControls && modeId === MODE.Runner) {
    jumpHeld = raw.slideHeld
    jumpJustPressed = raw.slideJustPressed
    slideHeld = raw.jumpHeld
  } else if (mods.invertControls) {
    dirX = -dirX as -1 | 0 | 1
    dirY = -dirY as -1 | 0 | 1
  }

  if (raw.directTouch && modeId === MODE.Shooter) actionHeld = true

  return {
    dirX,
    dirY,
    aimX: raw.aimX,
    aimY: raw.aimY,
    directTouch: raw.directTouch,
    actionHeld,
    actionJustPressed: raw.actionJustPressed,
    jumpHeld,
    jumpJustPressed,
    slideHeld,
  }
}
