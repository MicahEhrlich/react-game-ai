import { VIEW_W } from '../src/game/constants.ts'
import { computeZoom } from '../src/game/scale.ts'

function fail(message: string): never {
  console.error(`validate-scale: ${message}`)
  process.exit(1)
}

const pixelPortrait = computeZoom(396, 820)
if (!(pixelPortrait > 1 && pixelPortrait < 2)) {
  fail(`phone portrait zoom should be fractional and larger than 1x, got ${pixelPortrait}`)
}

const phoneCanvasW = pixelPortrait * VIEW_W
if (Math.abs(phoneCanvasW - 396) > 0.001) {
  fail(`phone portrait should fill available width, got ${phoneCanvasW}px`)
}

const tablet = computeZoom(820, 1024)
if (!(tablet > 2 && tablet < 3)) fail(`tablet zoom should be fractional, got ${tablet}`)

const desktop = computeZoom(1500, 900)
if (desktop !== 4) fail(`desktop zoom should floor to an integer, got ${desktop}`)

const invalid = computeZoom(0, 0)
if (invalid !== 1) fail(`invalid host size should fall back to 1x, got ${invalid}`)

console.log('validate-scale')
console.log('  OK  mobile zoom fills small screens while desktop stays crisp')
