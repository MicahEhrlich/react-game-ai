import { ALL_MODES, MODE } from '../state/types.ts'
import type { GameMode } from '../state/types.ts'
import { PALETTE } from '../game/art/palette.ts'

/** One row per string; one char per pixel; '.' is transparent. */
export type PixelSprite = readonly string[]

export const MEME_THEME_SOURCE = {
  Offline: 'offline',
  Live: 'live',
} as const
export type MemeThemeSource = (typeof MEME_THEME_SOURCE)[keyof typeof MEME_THEME_SOURCE]

export interface MemeModeFlavor {
  readonly enemy: string
  readonly obstacle: string
  readonly hazard: string
  readonly projectile: string
  readonly brick: string
}

export interface MemeTheme {
  readonly id: string
  readonly label: string
  readonly source: MemeThemeSource
  readonly date: string
  readonly palette: readonly string[]
  readonly shiftLines: readonly string[]
  readonly modeFlavor: Readonly<Record<GameMode, MemeModeFlavor>>
  readonly spritePack?: MemeSpritePack
  readonly taunts: readonly string[]
}

export type MemeThemeDraft = Partial<Omit<MemeTheme, 'source'>> & {
  readonly source?: unknown
  readonly modeFlavor?: unknown
}

const MAX_ID = 32
const MAX_LABEL = 22
const MAX_LINE = 54
const MAX_FLAVOR = 18
const MAX_TAUNT = 64
const SPRITE_SIZE = 16
const HEX = /^#[0-9a-fA-F]{6}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const URL_OR_MARKUP = /(https?:\/\/|www\.|<[^>]+>|[{}[\]\\])/i
const BLOCKED = /\b(fuck|shit|bitch|cunt|nigg\w*|fagg\w*|kike|rape|porn|sex|kill yourself|suicide)\b/i

export const MEME_SPRITE_ROLE = {
  PlatformerEnemy: 'platformerEnemy',
  PlatformerHazard: 'platformerHazard',
  ShooterEnemy: 'shooterEnemy',
  ShooterProjectile: 'shooterProjectile',
  RunnerObstacle: 'runnerObstacle',
  Brick: 'brick',
  BrickCracked: 'brickCracked',
  Ball: 'ball',
} as const
export type MemeSpriteRole = (typeof MEME_SPRITE_ROLE)[keyof typeof MEME_SPRITE_ROLE]
export const ALL_MEME_SPRITE_ROLES: readonly MemeSpriteRole[] = Object.values(MEME_SPRITE_ROLE)
export type MemeSpritePack = Readonly<Record<MemeSpriteRole, PixelSprite>>

const PIXEL_CHARS = new Set(['.', ...Object.keys(PALETTE)])

const DEFAULT_FLAVOR: MemeModeFlavor = {
  enemy: 'DRAMA BOT',
  obstacle: 'BAD TAKE',
  hazard: 'HOT TAKE',
  projectile: 'REPLY',
  brick: 'THREAD',
}

const OFFICE_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....DWWWWWWD....',
    '...DWwwwwwwWD...',
    '...DwkwwkwkWD...',
    '...DWwwwwwwWD...',
    '....DMMMMMD.....',
    '....DyyyyyD.....',
    '...DDDDDDDDD....',
    '..DdcccccddD....',
    '..DdcccccddD....',
    '...DDDDDDDDD....',
    '....D..D..D.....',
    '....D..D..D.....',
    '...MM..M..MM....',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '.......yy.......',
    '......yyyy......',
    '.....yoooyo.....',
    '....yoooooy.....',
    '...yoorrrrooy...',
    '..yooorrrroooy..',
    '.yooorMMMMroooy.',
    '.yyyyyMMMMyyyyy.',
    '....DMMMMMMD....',
    '....DcccccD.....',
    '....DcccccD.....',
    '....DDDDDDD.....',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '......DDDD......',
    '....DDWWWWDD....',
    '...DWccccccWD...',
    '..DWcDccccDcWD..',
    '.DWccccccccccWD.',
    '.DWWWWWWWWWWWWD.',
    '..DMMMcMMcMMMD..',
    '...DMMcMMcMMD...',
    '....DDDDDDDD....',
    '.....c....c.....',
    '....ccc..ccc....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '................',
    '................',
    '..yyyyyyyyyy....',
    '.ywwwwwwwwwwy...',
    '..yyyyyyyyyy....',
    '.....cc.........',
    '.....cc.........',
    '..yyyyyyyyyy....',
    '.ywwwwwwwwwwy...',
    '..yyyyyyyyyy....',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..DDDDDDDDDDDD..',
    '.DyyyyyyyyyyyyD.',
    '.DyDDyDDyDDyDDD.',
    '.DyyyyyyyyyyyyD.',
    '.DccccccccccccD.',
    '.DccccccccccccD.',
    '.DDDDDDDDDDDDDD.',
    '.DWWWWWWWWWWWWD.',
    '.DWWDWWWDWWWWDD.',
    '.DWWWWWWWWWWWWD.',
    '.DDDDDDDDDDDDDD.',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'cccccccccccccccc',
    'cWWWWWWWWWWWWWWC',
    'cWyyyyyyyyyyyyWC',
    'cWyyyyyyyyyyyyWC',
    'cWyyyyyyyyyyyyWC',
    'cWWWWWWWWWWWWWWC',
    'cMMMMMMMMMMMMMMC',
    'cMDDDDDDDDDDDDMC',
    'cMDDDDDDDDDDDDMC',
    'cMDDDDDDDDDDDDMC',
    'cMMMMMMMMMMMMMMC',
    'cWWWWWWWWWWWWWWC',
    'cWccccccccccccWC',
    'cWccccccccccccWC',
    'cWWWWWWWWWWWWWWC',
    'CCCCCCCCCCCCCCCC',
  ],
  brickCracked: [
    'cccccccccccccccc',
    'cWWWWWWWWWWWWWWC',
    'cWyyykkkyyyyyyWC',
    'cWyyyykkkyyyyyWC',
    'cWyyyyykkkyyyyWC',
    'cWWWWWWkWWWWWWWC',
    'cMMMMMMkMMMMMMMC',
    'cMDDDDkDDDDDDDMC',
    'cMDDDkDDDDDDDDMC',
    'cMDDkDDDDDDDDDMC',
    'cMMkMMMMMMMMMMMC',
    'cWWkWWWWWWWWWWWC',
    'cWccccckccccccWC',
    'cWcccccckcccccWC',
    'cWWWWWWWWkWWWWWC',
    'CCCCCCCCCCCCCCCC',
  ],
  ball: [
    '................',
    '................',
    '................',
    '................',
    '......yyyy......',
    '.....ywwwwy.....',
    '....ywwccwwy....',
    '....ywccccwy....',
    '....ywccccwy....',
    '....ywwccwwy....',
    '.....ywwwwy.....',
    '......yyyy......',
    '................',
    '................',
    '................',
    '................',
  ],
}

const COMMENT_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....rrrrrrrr....',
    '...rwwwwwwwwr...',
    '..rwwkkkkkkwwr..',
    '..rwkwwwwwwkwr..',
    '..rwwwwwwwwwwr..',
    '..rwkwwkkwwkwr..',
    '..rwwwwwwwwwwr..',
    '...rrrrrrrrrr...',
    '.....r....r.....',
    '....rrr..rrr....',
    '...r..r..r..r...',
    '..rr..r..r..rr..',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '.......rr.......',
    '......rrrr......',
    '.....rkkkkr.....',
    '....rkkkkkkr....',
    '...rkkkrrkkkr...',
    '..rkkrryrrkkkr..',
    '.rkkrryyyrrkkkr.',
    '.rrrrrrrrrrrrrr.',
    '....r......r....',
    '...rrr....rrr...',
    '..rrrrr..rrrrr..',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '.....rrrrrr.....',
    '...rrwwwwwwrr...',
    '..rwwrrrrrrwwr..',
    '.rwwrwwwwwwrwwr.',
    '.rwwrkkkkkkkwwr.',
    '.rwwrwwwwwwrwwr.',
    '..rwwrrrrrrwwr..',
    '...rrwwwwwwrr...',
    '.....rrrrrr.....',
    '....r..rr..r....',
    '...rrr....rrr...',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '................',
    '...rrrrrrrrr....',
    '..rwwwwwwwwwr...',
    '.rwwkkkwwwwwr...',
    '.rwwwwwwwwwr....',
    '..rrrrrrrrr.....',
    '......rr........',
    '......rr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '...rrrrrrrrrr...',
    '..rwwwwwwwwwwr..',
    '.rwwkkkkkkkkwwr.',
    '.rwkwrrrrrrwkwr.',
    '.rwwwwwwwwwwwwr.',
    '.rwkwwwwwwwwkwr.',
    '.rwwkkkkkkkkwwr.',
    '..rwwwwwwwwwwr..',
    '...rrrrrrrrrr...',
    '.....rr..rr.....',
    '....rr....rr....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'rrrrrrrrrrrrrrrr',
    'rwwwwwwwwwwwwwwR',
    'rwkkkkkkkkkkkkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkkkkkkkkkkkkwR',
    'rwwwwwwwwwwwwwwR',
    'rRRRRRRRRRRRRRRR',
    'rwwwwwwwwwwwwwwR',
    'rwkkkkkkkkkkkkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkwwwwwwwwwwkwR',
    'rwkkkkkkkkkkkkwR',
    'rwwwwwwwwwwwwwwR',
    'rRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRR',
  ],
  brickCracked: [
    'rrrrrrrrrrrrrrrr',
    'rwwwwwwwwwwwwwwR',
    'rwkkkkkkkkkkkkwR',
    'rwkwwrrrrrwwwkwR',
    'rwkwwwrrrwwwwkwR',
    'rwkkkkrkkkkkkkwR',
    'rwwwwwrwwwwwwwwR',
    'rRRRRrRRRRRRRRRR',
    'rwwwwrwwwwwwwwwR',
    'rwkkkrkkkkkkkkwR',
    'rwkwwrwwwwwwwkwR',
    'rwkwwrrwwwwwwkwR',
    'rwkkkkrrkkkkkkwR',
    'rwwwwwwwrrwwwwwR',
    'rRRRRRRRRrRRRRRR',
    'RRRRRRRRRRRRRRRR',
  ],
  ball: [
    '................',
    '................',
    '................',
    '.....rrrrrr.....',
    '....rwwwwwwr....',
    '...rwrrrrwwr....',
    '..rwwwwwwwwr....',
    '..rwwkkkwwwr....',
    '..rwwkkkwwwr....',
    '...rwwwwwwr.....',
    '....rrrrrr......',
    '......rr........',
    '......rr........',
    '................',
    '................',
    '................',
  ],
}

const ALGO_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '.....bbbbbb.....',
    '...bbCCCCCCbb...',
    '..bCCbbbbbbCCb..',
    '.bCCbckcckcbCCb.',
    '.bCCbCCCCCCbCCb.',
    '.bCCbCkkkkCbCCb.',
    '..bCCbbbbbbCCb..',
    '...bbCCCCCCbb...',
    '.....bbbbbb.....',
    '....bb....bb....',
    '...bb......bb...',
    '..bb........bb..',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '......oooo......',
    '.....oyyyyo.....',
    '....oyBBBBBo....',
    '...oyBBkkBBBo...',
    '..oyBBBkkBBBBo..',
    '.oyBBBBkkBBBBBo.',
    'oyBBBBBkkBBBBBBo',
    'oooooooooooooooo',
    '....b......b....',
    '...bbb....bbb...',
    '..bbbbb..bbbbb..',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '......bbbb......',
    '....bbCCCCbb....',
    '...bCCbbbbCCb...',
    '..bCCbCCCCbCCb..',
    '.bCCbCbbbbCbCCb.',
    '.bCCbCCCCCCbCCb.',
    '..bCCbbbbbbCCb..',
    '...bbCCCCCCbb...',
    '....bbbbbbbb....',
    '.....o....o.....',
    '....ooo..ooo....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '................',
    '....bbbbbbbb....',
    '...bCCCCCCCCb...',
    '..bCCooooCCb....',
    '.bCCCCCCCCb.....',
    '..bbbbbbbb......',
    '.....oo.........',
    '....oooo........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..bbbbbbbbbbbb..',
    '.bCCCCCCCCCCCCb.',
    '.bCbbCbbCbbCCCb.',
    '.bCCCCCCCCCCCCb.',
    '.bCoooooooooCCb.',
    '.bCokokokokoCCb.',
    '.bCoooooooooCCb.',
    '.bCCCCCCCCCCCCb.',
    '..bbbbbbbbbbbb..',
    '....oo....oo....',
    '...oooo..oooo...',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'bbbbbbbbbbbbbbbb',
    'bCCCCCCCCCCCCCCB',
    'bCooooooooooooCB',
    'bCokokokokokooCB',
    'bCooooooooooooCB',
    'bCCCCCCCCCCCCCCB',
    'bBBBBBBBBBBBBBBB',
    'bCCCCCCCCCCCCCCB',
    'bCooooooooooooCB',
    'bCokokokokokooCB',
    'bCooooooooooooCB',
    'bCCCCCCCCCCCCCCB',
    'bBBBBBBBBBBBBBBB',
    'bCCCCCCCCCCCCCCB',
    'bCCCCCCCCCCCCCCB',
    'BBBBBBBBBBBBBBBB',
  ],
  brickCracked: [
    'bbbbbbbbbbbbbbbb',
    'bCCCCCCCCCCCCCCB',
    'bCoooooBBoooooCB',
    'bCokokoBBBokooCB',
    'bCooooooBBooooCB',
    'bCCCCCCCBBCCCCCB',
    'bBBBBBBBBCBBBBBB',
    'bCCCCCCBBCCCCCCB',
    'bCooooBBooooooCB',
    'bCokoBBokokokoCB',
    'bCoooBBoooooooCB',
    'bCCCCBBCCCCCCCCB',
    'bBBBBBBBBBBBBBBB',
    'bCCCCCCCCCCCCCCB',
    'bCCCCCCCCCCCCCCB',
    'BBBBBBBBBBBBBBBB',
  ],
  ball: [
    '................',
    '................',
    '................',
    '......oooo......',
    '.....oCCCCo.....',
    '....oCCBBCCo....',
    '....oCBooBCo....',
    '....oCBoCBCo....',
    '....oCCBBCCo....',
    '.....oCCCCo.....',
    '......oooo......',
    '.......oo.......',
    '................',
    '................',
    '................',
    '................',
  ],
}

function line(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  if (!s || s.length > max) return null
  if (URL_OR_MARKUP.test(s)) return null
  if (BLOCKED.test(s)) return null
  return s.toUpperCase()
}

function list(v: unknown, maxItems: number, maxLen: number): readonly string[] | null {
  if (!Array.isArray(v)) return null
  const out = v.map((x) => line(x, maxLen)).filter((x): x is string => x !== null)
  if (out.length === 0 || out.length > maxItems) return null
  return out
}

function flavor(v: unknown): MemeModeFlavor | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const enemy = line(r.enemy, MAX_FLAVOR)
  const obstacle = line(r.obstacle, MAX_FLAVOR)
  const hazard = line(r.hazard, MAX_FLAVOR)
  const projectile = line(r.projectile, MAX_FLAVOR)
  const brick = line(r.brick, MAX_FLAVOR)
  if (!enemy || !obstacle || !hazard || !projectile || !brick) return null
  return { enemy, obstacle, hazard, projectile, brick }
}

function modeFlavor(v: unknown): Readonly<Record<GameMode, MemeModeFlavor>> | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const out: Partial<Record<GameMode, MemeModeFlavor>> = {}
  for (const mode of ALL_MODES) {
    const f = flavor(r[mode])
    if (!f) return null
    out[mode] = f
  }
  return out as Readonly<Record<GameMode, MemeModeFlavor>>
}

function sprite(v: unknown): PixelSprite | null {
  if (!Array.isArray(v) || v.length !== SPRITE_SIZE) return null
  const rows: string[] = []
  for (const row of v) {
    if (typeof row !== 'string' || row.length !== SPRITE_SIZE) return null
    for (const ch of row) {
      if (!PIXEL_CHARS.has(ch)) return null
    }
    rows.push(row)
  }
  return rows
}

function spritePack(v: unknown, required: boolean): MemeSpritePack | undefined | null {
  if (v === undefined || v === null) return required ? null : undefined
  if (typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const out: Partial<Record<MemeSpriteRole, PixelSprite>> = {}
  for (const role of ALL_MEME_SPRITE_ROLES) {
    const s = sprite(r[role])
    if (!s) return null
    out[role] = s
  }
  return out as MemeSpritePack
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normaliseMemeTheme(raw: unknown, date: string, source: MemeThemeSource): MemeTheme | null {
  if (typeof raw !== 'object' || raw === null) return null
  if (!DATE.test(date)) return null
  const r = raw as Record<string, unknown>
  const id = line(r.id, MAX_ID)
  const label = line(r.label, MAX_LABEL)
  const palette = Array.isArray(r.palette)
    ? r.palette.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 4)
    : []
  const shiftLines = list(r.shiftLines, 4, MAX_LINE)
  const taunts = list(r.taunts, 5, MAX_TAUNT)
  const mode = modeFlavor(r.modeFlavor)
  const sprites = spritePack(r.spritePack, source === MEME_THEME_SOURCE.Live)

  if (!id || !label || palette.length < 2 || palette.length > 4 || !shiftLines || !taunts || !mode || sprites === null) {
    return null
  }

  return {
    id,
    label,
    source,
    date,
    palette,
    shiftLines,
    modeFlavor: mode,
    ...(sprites ? { spritePack: sprites } : {}),
    taunts,
  }
}

export const OFFLINE_MEME_THEMES: readonly MemeTheme[] = [
  {
    id: 'office-brainrot',
    label: 'OFFICE BRAINROT',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#3ef0ff', '#ffe14d', '#ff3ea5'],
    shiftLines: ['SYNERGY HAS ENTERED THE CHAT', 'THIS MEETING COULD HAVE BEEN A BOSS FIGHT'],
    taunts: ['CALENDAR INVITE ACCEPTED', 'ACTION ITEMS ARE SENTIENT'],
    spritePack: OFFICE_SPRITES,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'MANAGER BOT', hazard: 'SCOPE CREEP' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'EMAIL DRONE', projectile: 'PING' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'STANDUP', hazard: 'BLOCKER' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'Q4 DECK', projectile: 'FOLLOWUP' },
    },
  },
  {
    id: 'comment-section',
    label: 'COMMENT SECTION',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#ff4d4d', '#3ef0ff', '#4dff9a'],
    shiftLines: ['THE REPLIES ARE MATERIALIZING', 'DO NOT READ THE QUOTE POSTS'],
    taunts: ['RATIO DETECTED', 'THREAD MUTED TOO LATE'],
    spritePack: COMMENT_SPRITES,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'REPLY GUY', hazard: 'RATIO' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'TAKE DRONE', projectile: 'QUOTE POST' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'DISCOURSE', hazard: 'DOGPILE' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'TAKE WALL', projectile: 'DUNK' },
    },
  },
  {
    id: 'algorithm-soup',
    label: 'ALGORITHM SOUP',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#4d7cff', '#ff9a2e', '#f2eeff'],
    shiftLines: ['THE FEED HAS CHOSEN VIOLENCE', 'ENGAGEMENT BAIT ARMED'],
    taunts: ['FOR YOU PAGE FORGOT YOU', 'OPTIMIZED FOR PANIC'],
    spritePack: ALGO_SPRITES,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'FEED BOT', hazard: 'BAIT PIT' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'BOT SWARM', projectile: 'CLICKBAIT' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'AUTO PLAY', hazard: 'SCROLL TRAP' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'FEED BLOCK', projectile: 'BOOST' },
    },
  },
]

export function offlineMemeThemeForDate(date = localDateKey()): MemeTheme {
  const n = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const base = OFFLINE_MEME_THEMES[n % OFFLINE_MEME_THEMES.length]
  return { ...base, date, source: MEME_THEME_SOURCE.Offline }
}

export function memeAccent(theme: MemeTheme, index: number, fallback = '#3ef0ff'): string {
  return theme.palette[index % theme.palette.length] ?? fallback
}

export function memeAccentNumber(theme: MemeTheme, index: number, fallback = 0x3ef0ff): number {
  const c = memeAccent(theme, index)
  return HEX.test(c) ? Number.parseInt(c.slice(1), 16) : fallback
}
