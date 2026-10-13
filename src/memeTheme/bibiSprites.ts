import { PALETTE } from '../game/art/palette.ts'
import type { MemeSpritePack, PixelSprite } from './index.ts'

export const BIBI_THEME_ID = 'bibi-mode'
export const COURT_TEXT = 'בג״ץ'
export const BIBI_CALLOUTS = ['קפלניסטים', 'שמאלנים'] as const

export const RED_CLOCK: PixelSprite = [
  '................', '..rrr......rrr..', '.rRRr......rRRr.', '..rr..kkkk..rr..',
  '....kkrrrrkk....', '...krrwwwwrrk...', '..krwwwwwwwwrk..', '..krwwwwkwwwrk..',
  '..krwwwwkwwwrk..', '..krwwwwkkwwrk..', '..krwwwwwwwwrk..', '...krrwwwwrrk...',
  '....kkrrrrkk....', '.....rkkkkr.....', '....rr....rr....', '................',
]
export const COURT_CUBE: PixelSprite = [
  '................', '....wwwwwwwww...', '...wsssssssswk..', '..wsssssssswDk..',
  '.wwwwwwwwwwDDk..', '.wssssssswDDDk..', '.wswwwwsswDDDk..', '.wswsswsswDDDk..',
  '.wswsswsswDDDk..', '.wswwwwsswDDDk..', '.wssssssswDDDk..', '.wssssssswDDDk..',
  '.wssssssswDDk...', '.wwwwwwwwwDk....', '..kkkkkkkkk.....', '................',
]
export const QATAR_DOLLAR: PixelSprite = [
  '................', '................', '................', '.GGGGGGGGGGGGGG.',
  '.GggggggggggggG.', '.GgGGggGGggGGgG.', '.GgGgggGggggGgG.', '.GggggGGGgggggG.',
  '.GgggggGgGggggG.', '.GgGggGGGgggGgG.', '.GgGGggGgggGGgG.', '.GggggggggggggG.',
  '.GGGGGGGGGGGGGG.', '................', '................', '................',
]
/** Portrait palette adds skin, hair and suit shading without changing other themes. */
export const BIBI_CHARACTER_PALETTE: Readonly<Record<string, string | undefined>> = {
  ...PALETTE,
  '0': '#eef2f1', '1': '#cbd2d4', '2': '#909da2', '3': '#182f48',
  '4': '#dd9e7c', '5': '#ffdec5', '6': '#ae7155',
  '7': '#35669a', '8': '#244d7b', '9': '#112d50',
}
export const BIBI_CHARACTER_WIDTH = 24
export const BIBI_CHARACTER_HEIGHT = 32
export const BIBI_CHARACTER_ORIGIN_Y = 24
export const BIBI_HEAD_HEIGHT = 19

/** Reference-inspired receding silver hair, high lined forehead, heavy brows and firm jaw. */
export const BIBI_CHARACTER: PixelSprite = [
  'kkkkkkkk',
  'kk1100001111kk',
  'k2110000111112k',
  'k21005555555112k',
  'k21f55555555512k',
  'k21f55f444455f2k',
  'k21f555555555f2k',
  'k21f554444555f2k',
  'k21f555fff555f2k',
  'k2ff433355334ffk',
  'k4f53kw3f3kw54fk',
  'k4f544f55f4454fk',
  'k4f5f45f54f5f4k',
  'k4ff55f66f55f4k',
  'k4fff53k3f5ff4k',
  'k4ff4f45544fff4k',
  'k4fff43kk34fff4k',
  'kk4fff555fff4kk',
  'kkk4ffff4kkk',
  'k998wwww899k',
  'k9888wwwb8889k',
  'k9788wBbw88789k',
  'k97888ww888789k',
  'k978ff88888ff789k',
  'k98784ff44ff48789k',
  'k988877888778889k',
  'k98888799888889k',
  'k998899kk998899k',
  'k9889kk..kk9889k',
  'k9889k....k9889k',
  'kk99kk....kk99kk',
  'kkkkkk....kkkkkk',
].map((row) => row.padStart(Math.floor((BIBI_CHARACTER_WIDTH + row.length) / 2), '.')
  .padEnd(BIBI_CHARACTER_WIDTH, '.'))
  .map((row, y) => {
    if (y < 10 || y > 12) return row
    const pixels = [...row]
    pixels[2] = 'k'; pixels[3] = y === 11 ? '6' : '4'
    pixels[20] = '4'; pixels[21] = 'k'
    return pixels.join('')
  })

export const BIBI_HEAD: PixelSprite = BIBI_CHARACTER.slice(0, BIBI_HEAD_HEIGHT)

function monochrome(pixel: string): string {
  const color = BIBI_CHARACTER_PALETTE[pixel]
  if (!color) return '.'
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  return r * 0.299 + g * 0.587 + b * 0.114 >= 140 ? 'w' : 'k'
}

export const BIBI_MONO_HEAD: PixelSprite = BIBI_HEAD.map((row) => [...row].map(monochrome).join(''))
export const BIBI_DATE_LABEL = '7.10'
export const BIBI_DATE_WIDTH = 48
export const BIBI_DATE_HEIGHT = 20

/** Pixel numerals 7.1 followed by the monochrome portrait in the zero's position. */
function dateMark(): PixelSprite {
  const pixels = Array.from({ length: BIBI_DATE_HEIGHT }, () => Array<string>(BIBI_DATE_WIDTH).fill('.'))
  const glyphs = [
    ['wwwww', '....w', '...w.', '..w..', '..w..', '.w...', '.w...'],
    ['..w..', '.ww..', '..w..', '..w..', '..w..', '..w..', '.www.'],
  ]
  glyphs.forEach((glyph, index) => glyph.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel !== 'w') return
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) pixels[3 + y * 2 + dy][index * 18 + x * 2 + dx] = 'w'
  })))
  for (let y = 15; y < 17; y++) for (let x = 13; x < 15; x++) pixels[y][x] = 'w'
  for (let y = 0; y < BIBI_DATE_HEIGHT; y++) for (let x = 0; x < 16; x++) {
    pixels[y][32 + x] = BIBI_MONO_HEAD[Math.floor(y * BIBI_HEAD_HEIGHT / BIBI_DATE_HEIGHT)]
      [Math.floor(x * BIBI_CHARACTER_WIDTH / 16)]
  }
  // A black outline keeps the white digits legible against bright backdrops.
  const outlined = pixels.map((row) => [...row])
  for (let y = 0; y < pixels.length; y++) for (let x = 0; x < 32; x++) {
    if (pixels[y][x] !== 'w') continue
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (outlined[y + dy]?.[x + dx] === '.') outlined[y + dy][x + dx] = 'k'
    }
  }
  return outlined.map((row) => row.join(''))
}
export const BIBI_DATE_MARK = dateMark()

export const AIRCRAFT_TITLE = 'כנף ציון'
export const AIRCRAFT_WIDTH = 48
export const AIRCRAFT_HEIGHT = 48
export const AIRCRAFT_ORIGIN_Y = 40
export const AIRCRAFT_STAR_X = 5
export const AIRCRAFT_STAR_Y = 28
export const AIRCRAFT_STAR: PixelSprite = [
  '...b...', '..b.b..', 'bbbbbbb', '.b...b.', 'bbbbbbb', '..b.b..', '...b...',
]

/** Artwork is outside the 16px theme atlas; the physics ship remains 16px. */
function aircraftSprite(): PixelSprite {
  const pixels = Array.from({ length: AIRCRAFT_HEIGHT }, () => Array<string>(AIRCRAFT_WIDTH).fill('.'))
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) pixels[row + 16][col] = color
  }
  const aircraftY = 16
  // Right-facing airliner: raised tail, white hull and blue cheatline.
  for (let row = 10; row <= 21; row++) {
    const width = Math.min(12, 9 + Math.floor((row - 10) / 2))
    rect(3, row, width, 1, 'k')
    rect(4, row, width - 2, 1, 'w')
  }
  rect(3, 20, 39, 8, 'k')
  rect(5, 21, 37, 6, 'w')
  rect(42, 21, 2, 6, 'w'); rect(44, 22, 2, 4, 'w'); rect(46, 23, 1, 2, 's')
  rect(5, 26, 36, 1, 'b')
  rect(40, 21, 3, 2, 'B')
  // Swept wing and shaded engine, below the text-bearing fuselage.
  for (let row = 27; row < 31; row++) rect(17 - (row - 27) * 2, row, 12, 1, row === 30 ? 's' : 'w')
  rect(24, 27, 8, 4, 'k'); rect(25, 27, 6, 3, 's'); rect(25, 27, 4, 2, 'w')
  rect(4, 24, 8, 1, 's')
  // The emblem is drawn last so neither the stripe nor the wing can cover it.
  AIRCRAFT_STAR.forEach((row, y) => [...row].forEach((color, x) => {
    pixels[aircraftY + 12 + y][5 + x] = color === '.' ? 'w' : color
  }))
  BIBI_CHARACTER.forEach((row, y) => [...row].forEach((color, x) => {
    if (color !== '.') pixels[4 + y][20 + x] = color
  }))
  return pixels.map((row) => row.join(''))
}

export const BIBI_AIRCRAFT = aircraftSprite()

function protesterSprite(hair: string, skin: string, shirt: string, symbol: readonly string[]): PixelSprite {
  const pixels = Array.from({ length: 16 }, () => Array<string>(16).fill('.'))
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) pixels[row][col] = color
  }
  // A raised placard and its pole, visibly held by the left hand.
  rect(0, 0, 8, 7, 'k'); rect(1, 1, 6, 5, 'w'); rect(4, 7, 1, 4, 's')
  symbol.forEach((row, y) => [...row].forEach((color, x) => {
    if (color !== '.') pixels[y + 2][x + 2] = color
  }))
  rect(10, 3, 4, 1, hair); rect(9, 4, 6, 2, hair)
  rect(10, 5, 4, 4, skin); rect(11, 6, 1, 1, 'k'); rect(13, 6, 1, 1, 'k')
  rect(10, 9, 4, 4, shirt); rect(8, 9, 2, 2, shirt); rect(5, 9, 3, 1, skin)
  rect(14, 10, 1, 3, skin)
  rect(10, 13, 2, 2, 'd'); rect(13, 13, 2, 2, 'd')
  rect(9, 15, 3, 1, 'k'); rect(13, 15, 3, 1, 'k')
  return pixels.map((row) => row.join(''))
}

export const PROTESTER_SPRITES: readonly PixelSprite[] = [
  protesterSprite('k', 'f', 'b', ['.b..', 'bbb.', '.b..']),
  protesterSprite('s', 't', 'g', ['.bb.', 'b..b', '.bb.']),
  protesterSprite('o', 'f', 'r', ['r..r', '.rr.', '..r.']),
  protesterSprite('D', 'o', 'm', ['.g..', 'g.g.', '.g..']),
]

export const BIBI_SPRITES: MemeSpritePack = {
  platformerEnemy: PROTESTER_SPRITES[0], platformerHazard: RED_CLOCK,
  shooterEnemy: RED_CLOCK, shooterProjectile: QATAR_DOLLAR,
  runnerObstacle: RED_CLOCK, brick: COURT_CUBE, brickCracked: COURT_CUBE,
  ball: RED_CLOCK, apple: QATAR_DOLLAR, honey: QATAR_DOLLAR,
}
