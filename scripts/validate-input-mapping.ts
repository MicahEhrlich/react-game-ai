import { DEFAULT_MODIFIERS } from '../src/director/modifiers.ts'
import { mapInputForMode } from '../src/game/inputMapping.ts'
import type { RawInputState } from '../src/game/inputMapping.ts'
import { MODE } from '../src/state/types.ts'

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

for (const mode of Object.values(MODE)) {
  const input = mapInputForMode(neutral, mode, inverted)
  if (
    input.dirX !== 0 ||
    input.dirY !== 0 ||
    input.actionHeld ||
    input.actionJustPressed ||
    input.jumpHeld ||
    input.jumpJustPressed ||
    input.slideHeld
  ) {
    fail(`${mode} neutral input was not neutral`)
  }
}

console.log('validate-input-mapping')
console.log('  OK  mode-specific inverted controls map correctly')
