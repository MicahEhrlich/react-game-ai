import { DEFAULT_MODIFIERS } from '../src/director/modifiers.ts'
import { mapInputForMode } from '../src/game/inputMapping.ts'
import type { RawInputState } from '../src/game/inputMapping.ts'
import { VIEW_H, VIEW_W } from '../src/game/constants.ts'
import {
  brickTouchDirX,
  platformerTouchDirX,
  shooterTouchDir,
} from '../src/game/touchSteering.ts'
import { MODE } from '../src/state/types.ts'
import { viewportToGamePoint } from '../src/ui/touchGeometry.ts'

function fail(message: string): never {
  console.error(`validate-input-mapping: ${message}`)
  process.exit(1)
}

const neutral: RawInputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpJustPressed: false,
  slideHeld: false,
  slideJustPressed: false,
  actionHeld: false,
  actionJustPressed: false,
  aimX: null,
  aimY: null,
  directTouch: false,
}

const normal = DEFAULT_MODIFIERS
const inverted = { ...DEFAULT_MODIFIERS, invertControls: true }

{
  const input = mapInputForMode(
    { ...neutral, up: true, jumpHeld: true, jumpJustPressed: true },
    MODE.Runner,
    normal,
  )
  if (!input.jumpJustPressed || !input.jumpHeld) fail('normal runner up/jump did not map to jump')
  if (input.slideHeld) fail('normal runner up/jump incorrectly mapped to slide')
}

{
  const input = mapInputForMode(
    { ...neutral, down: true, slideHeld: true, slideJustPressed: true },
    MODE.Runner,
    normal,
  )
  if (!input.slideHeld) fail('normal runner down/slide did not map to slide')
  if (input.jumpJustPressed) fail('normal runner down/slide incorrectly mapped to jump')
}

{
  const input = mapInputForMode(
    { ...neutral, down: true, slideHeld: true, slideJustPressed: true },
    MODE.Runner,
    inverted,
  )
  if (!input.jumpJustPressed || !input.jumpHeld) {
    fail('inverted runner down/slide did not map to jump')
  }
  if (input.slideHeld) fail('inverted runner down/slide incorrectly stayed slide')
}

{
  const input = mapInputForMode(
    { ...neutral, up: true, jumpHeld: true, jumpJustPressed: true },
    MODE.Runner,
    inverted,
  )
  if (!input.slideHeld) fail('inverted runner up/jump did not map to slide')
  if (input.jumpJustPressed || input.jumpHeld) fail('inverted runner up/jump incorrectly stayed jump')
}

{
  const input = mapInputForMode({ ...neutral, left: true, up: true }, MODE.Platformer, inverted)
  if (input.dirX !== 1 || input.dirY !== 1) fail('platformer inverted axes did not flip')
}

{
  const input = mapInputForMode({ ...neutral, right: true, down: true }, MODE.Shooter, inverted)
  if (input.dirX !== -1 || input.dirY !== -1) fail('shooter inverted axes did not flip')
}

{
  const input = mapInputForMode({ ...neutral, left: true, up: true }, MODE.Runner, inverted)
  if (input.dirX !== -1 || input.dirY !== -1) fail('runner inverted axes should not flip')
}

{
  const input = mapInputForMode(
    { ...neutral, directTouch: true, aimX: 120, aimY: 80 },
    MODE.Shooter,
    normal,
  )
  if (!input.actionHeld) fail('mobile shooter did not auto-fire')
  if (input.aimX !== 120 || input.aimY !== 80 || !input.directTouch) {
    fail('mobile shooter target did not survive input mapping')
  }
}

{
  const input = mapInputForMode(
    { ...neutral, directTouch: true, aimX: 40, aimY: 120 },
    MODE.Brick,
    normal,
  )
  if (input.aimX !== 40 || input.aimY !== 120 || !input.directTouch) {
    fail('mobile brick target did not survive input mapping')
  }
  if (input.actionHeld) fail('mobile brick incorrectly auto-fired')
}

for (const mode of Object.values(MODE)) {
  const input = mapInputForMode(neutral, mode, inverted)
  if (
    input.dirX !== 0 ||
    input.dirY !== 0 ||
    input.actionHeld ||
    input.actionJustPressed ||
    input.jumpHeld ||
    input.jumpJustPressed ||
    input.slideHeld ||
    input.directTouch ||
    input.aimX !== null ||
    input.aimY !== null
  ) {
    fail(`${mode} neutral input was not neutral`)
  }
}

{
  const rect = { left: 10, top: 20, width: 640, height: 360 }
  const topLeft = viewportToGamePoint(10, 20, rect)
  const bottomRight = viewportToGamePoint(650, 380, rect)
  const clamped = viewportToGamePoint(999, -999, rect)
  if (topLeft.x !== 0 || topLeft.y !== 0) fail('touch geometry did not map top-left to 0,0')
  if (bottomRight.x !== VIEW_W || bottomRight.y !== VIEW_H) {
    fail('touch geometry did not map bottom-right to game bounds')
  }
  if (clamped.x !== VIEW_W || clamped.y !== 0) fail('touch geometry did not clamp out-of-bounds input')

  const centeredCanvas = { left: 40, top: 100, width: 396, height: 237.6 }
  const center = viewportToGamePoint(238, 218.8, centeredCanvas)
  if (Math.abs(center.x - VIEW_W / 2) > 0.001 || Math.abs(center.y - VIEW_H / 2) > 0.001) {
    fail('touch geometry did not respect a centered canvas rect')
  }
}

{
  if (platformerTouchDirX(180, 400, 560) !== 1) fail('platformer touch right of player did not steer right')
  if (platformerTouchDirX(140, 400, 560) !== -1) fail('platformer touch left of player did not steer left')
  if (platformerTouchDirX(158, 400, 560) !== 0) fail('platformer touch dead zone did not stop movement')

  const rightDown = shooterTouchDir(180, 120, 160, 96)
  if (rightDown.dirX !== 1 || rightDown.dirY !== 1) fail('shooter touch right/down did not steer right/down')
  const leftUp = shooterTouchDir(120, 60, 160, 96)
  if (leftUp.dirX !== -1 || leftUp.dirY !== -1) fail('shooter touch left/up did not steer left/up')
  const still = shooterTouchDir(166, 101, 160, 96)
  if (still.dirX !== 0 || still.dirY !== 0) fail('shooter touch dead zone did not stop movement')

  if (brickTouchDirX(180, 160) !== 1) fail('brick touch right of paddle did not steer right')
  if (brickTouchDirX(120, 160) !== -1) fail('brick touch left of paddle did not steer left')
  if (brickTouchDirX(166, 160) !== 0) fail('brick touch dead zone did not stop movement')
}

console.log('validate-input-mapping')
console.log('  OK  mode-specific inverted controls map correctly')
