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
  readonly musicPlan: MemeMusicPlan
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
const MAX_PATTERN = 16
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

export const MUSIC_SCALE = {
  Minor: 'minor',
  Major: 'major',
  Pentatonic: 'pentatonic',
  Chromatic: 'chromatic',
} as const
export type MusicScale = (typeof MUSIC_SCALE)[keyof typeof MUSIC_SCALE]

export interface MemeMusicPlan {
  readonly style: string
  readonly bpm: number
  readonly scale: MusicScale
  /** Scale degrees, 0..7, or -1 for a rest. */
  readonly bassPattern: readonly number[]
  readonly leadPattern: readonly number[]
  /** 0 rest, 1 kick, 2 snare, 3 hat, 4 noise hit. */
  readonly drumPattern: readonly number[]
  readonly intensity: number
}

const PIXEL_CHARS = new Set(['.', ...Object.keys(PALETTE)])
const SCALES = new Set<string>(Object.values(MUSIC_SCALE))

const MUSIC = {
  Office: {
    style: 'syncopated office panic',
    bpm: 134,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 0, 3, 0, -1, 5, 3],
    leadPattern: [7, 6, -1, 5, 3, -1, 2, 3, 5, -1, 6, 5, 3, 2, -1, 0],
    drumPattern: [1, 3, 2, 3, 1, 3, 2, 4, 1, 3, 2, 3, 1, 3, 2, 3],
    intensity: 0.62,
  },
  Comment: {
    style: 'argument arcade',
    bpm: 152,
    scale: MUSIC_SCALE.Chromatic,
    bassPattern: [0, 1, -1, 0, 3, -1, 2, 1],
    leadPattern: [5, 6, 5, -1, 3, 2, 3, -1, 6, 7, 6, 5, -1, 3, 2, 1],
    drumPattern: [1, 3, 2, 3, 1, 4, 2, 3, 1, 3, 2, 3, 1, 3, 2, 4],
    intensity: 0.74,
  },
  Algo: {
    style: 'feed scroll trance',
    bpm: 128,
    scale: MUSIC_SCALE.Pentatonic,
    bassPattern: [0, -1, 2, -1, 3, -1, 2, -1],
    leadPattern: [0, 2, 3, 5, -1, 7, 5, 3, 2, -1, 3, 5, 7, 5, 3, 2],
    drumPattern: [1, 3, 3, 2, 1, 3, 3, 2, 1, 3, 4, 2, 1, 3, 3, 2],
    intensity: 0.58,
  },
  SixSeven: {
    style: 'six seven bounce',
    bpm: 167,
    scale: MUSIC_SCALE.Pentatonic,
    bassPattern: [6, -1, 7, -1, 6, 7, -1, 3],
    leadPattern: [6, 7, -1, 6, 7, 5, -1, 3, 6, 7, -1, 7, 6, 3, -1, 0],
    drumPattern: [1, 3, 2, 3, 1, 4, 2, 3, 1, 3, 2, 3, 1, 3, 2, 4],
    intensity: 0.78,
  },
  Rizz: {
    style: 'smooth neon flex',
    bpm: 116,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, -1, 3, -1, 5, -1, 3, -1],
    leadPattern: [7, -1, 6, 5, -1, 3, 5, 6, 7, -1, 5, 3, -1, 2, 3, 5],
    drumPattern: [1, 3, 3, 2, 1, 3, 3, 2, 1, 3, 4, 2, 1, 3, 3, 2],
    intensity: 0.52,
  },
  Npc: {
    style: 'looping npc chant',
    bpm: 140,
    scale: MUSIC_SCALE.Minor,
    bassPattern: [0, 0, -1, 0, 2, 2, -1, 2],
    leadPattern: [3, -1, 3, -1, 2, -1, 2, -1, 5, -1, 5, -1, 3, 2, -1, 0],
    drumPattern: [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 4, 1, 3, 2, 3],
    intensity: 0.64,
  },
} satisfies Record<string, MemeMusicPlan>

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

const SIX_SEVEN_SPRITES: MemeSpritePack = {
  ...ALGO_SPRITES,
  platformerEnemy: [
    '................',
    '...fff..........',
    '..fyyyf.........',
    '...fff..........',
    '....f.......fff.',
    '....ff.....fyyyf',
    '.....ff.....fff.',
    '......ff.....f..',
    '......DffffffD..',
    '.....DwwwwwwwwD.',
    '.....DwkwwkwkD..',
    '.....DwwwwwwD...',
    '......DDDDDD....',
    '......D....D....',
    '.....DD....DD...',
    '................',
  ],
  platformerHazard: [
    '................',
    '...fff.....fff..',
    '..fyyyf...fyyyf.',
    '...fff.....fff..',
    '....f.......f...',
    '....ff.....ff...',
    '.....ff...ff....',
    '......ff.ff.....',
    '.......fff......',
    '......ff.ff.....',
    '.....ff...ff....',
    '....ff.....ff...',
    '...ff.......ff..',
    '..fff.......fff.',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '...fff......fff.',
    '..fyyyf....fyyyf',
    '...fff......fff.',
    '....f........f..',
    '....ff......ff..',
    '.....ff....ff...',
    '..CCCCffffffCCCC',
    '.CwwwwwwwwwwwwC.',
    '.CwkkwwwwwwkkwC.',
    '..CwwwwwwwwwwC..',
    '...CCCCCCCCCC...',
    '....C......C....',
    '...CCC....CCC...',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '.....fff........',
    '....fyyyf.......',
    '.....fff........',
    '......f.........',
    '......ff........',
    '................',
    '.........fff....',
    '........fyyyf...',
    '.........fff....',
    '.........f......',
    '........ff......',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..fff......fff..',
    '.fyyyf....fyyyf.',
    '..fff......fff..',
    '...f........f...',
    '...ff......ff...',
    '....ff....ff....',
    '.....ffffff.....',
    '....DyyyyyyD....',
    '....DwwkkwwD....',
    '.....DDDDDD.....',
    '....ff....ff....',
    '...fff....fff...',
    '................',
    '................',
    '................',
  ],
  brick: [
    'yyyyyyyyCCCCCCCC',
    'ywwwwwwyCwwwwwwC',
    'ywkkkkwyCwkkkkwC',
    'ywkwwwy.CwkwkwC.',
    'ywkkkkwyCwkkkkwC',
    'ywwwwwwyCwwwwwwC',
    'yyyyyyyyCCCCCCCC',
    '................',
    'CCCCCCCCyyyyyyyy',
    'CwwwwwwCywwwwwwy',
    'CwkkkkwCywkkkkwy',
    '.CwkwkwC.ywkwwwy',
    'CwkkkkwCywkkkkwy',
    'CwwwwwwCywwwwwwy',
    'CCCCCCCCyyyyyyyy',
    '................',
  ],
  brickCracked: [
    'yyyyyyyyCCCCCCCC',
    'ywwwrwwyCwwwrwwC',
    'ywkkrrwyCwkrrkwC',
    'ywkwwwr.CwkwrwC.',
    'ywkkkrryCwrrkkwC',
    'ywwwwwwyCwwwwwwC',
    'yyyyyyyyCCCCCCCC',
    '................',
    'CCCCCCCCyyyyyyyy',
    'CwwrwwwCywwrwwwy',
    'CwkrrkwCywkrrkwy',
    '.CwkwrwC.ywkwwry',
    'CwrrkkwCyrrkkkwy',
    'CwwwwwwCywwwwwwy',
    'CCCCCCCCyyyyyyyy',
    '................',
  ],
  ball: [
    '................',
    '.....yyyyyy.....',
    '....ywwwwwwy....',
    '...ywkkwwwwy....',
    '...ywwwwwwy.....',
    '....yyyyyy......',
    '......yy........',
    '.....CCCCCC.....',
    '....CwwwwwwC....',
    '...CwwwwkkwC....',
    '....CwwwwwwC....',
    '.....CCCCCC.....',
    '.......CC.......',
    '................',
    '................',
    '................',
  ],
}

const RIZZ_SPRITES: MemeSpritePack = {
  ...COMMENT_SPRITES,
  platformerEnemy: [
    '................',
    '.....MM..MM.....',
    '....MwwMMwwM....',
    '...MwwwwwwwwM...',
    '...MwkkwwkkwM...',
    '....MwwwwwwM....',
    '.....MwwwwM.....',
    '......MwwM......',
    '.......MM.......',
    '....MMMwwMMM....',
    '...MwwwwwwwwM...',
    '....M......M....',
    '...MM......MM...',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '......MMMM......',
    '....MMwwwwMM....',
    '...MwwMMMMwwM...',
    '..MwwMwwwwMwwM..',
    '.MwwMwwkkwwMwwM.',
    '.MwwMwwwwwwMwwM.',
    '..MwwMMMMMMwwM..',
    '...MMwwwwwwMM...',
    '....MMMMMMMM....',
    '.....M....M.....',
    '....MMM..MMM....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'MMMMMMMMMMMMMMMM',
    'MwwwwwwMMwwwwwwM',
    'MwkkkkMwwMkkkkwM',
    'MwkkkMwwwwMkkkwM',
    'MwwwMwwwwwwMwwwM',
    'MwwMwwMMMMwwMwwM',
    'MMMwwMwwwwMwwMMM',
    'MMwwMwwkkwwMwwMM',
    'MMMwwMwwwwMwwMMM',
    'MwwMwwMMMMwwMwwM',
    'MwwwMwwwwwwMwwwM',
    'MwkkkMwwwwMkkkwM',
    'MwkkkkMwwMkkkkwM',
    'MwwwwwwMMwwwwwwM',
    'MMMMMMMMMMMMMMMM',
    '................',
  ],
}

const NPC_SPRITES: MemeSpritePack = {
  ...OFFICE_SPRITES,
  platformerEnemy: [
    '................',
    '....gggggggg....',
    '...gwwwwwwwwg...',
    '..gwkkkkkkkkwg..',
    '..gwkwwkkwwkwg..',
    '..gwkkkkkkkkwg..',
    '..gwwwwwwwwwwg..',
    '...gggggggggg...',
    '....g..gg..g....',
    '....g..gg..g....',
    '...gg..gg..gg...',
    '..gwwggggggwwg..',
    '...gg......gg...',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '..gggggggggggg..',
    '.gwwwwwwwwwwwwg.',
    '.gwkkkkkkkkkkwg.',
    '.gwkggwwggkkkwg.',
    '.gwkkkkkkkkkkwg.',
    '.gwwwwwwwwwwwwg.',
    '..gggggggggggg..',
    '................',
    '..gggggggggggg..',
    '.gwwggkkggkkwwg.',
    '..gggggggggggg..',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..gggg..gggg....',
    '.gwwwwggwwwwg...',
    '.gwkkwggwkkwg...',
    '.gwwwwggwwwwg...',
    '..gggg..gggg....',
    '..g..g..g..g....',
    '..gggg..gggg....',
    '.gwwwwggwwwwg...',
    '.gwkkwggwkkwg...',
    '.gwwwwggwwwwg...',
    '..gggg..gggg....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'gggggggggggggggg',
    'gwwwwwwggwwwwwwg',
    'gwkkkwggggwkkkwg',
    'gwwwwwgkkgwwwwwg',
    'gggggggkkggggggg',
    'gwwwwwwggwwwwwwg',
    'gwkkkwggggwkkkwg',
    'gwwwwwwggwwwwwwg',
    'gggggggkkggggggg',
    'gwwwwwgkkgwwwwwg',
    'gwkkkwggggwkkkwg',
    'gwwwwwwggwwwwwwg',
    'gggggggggggggggg',
    '................',
    'gggggggggggggggg',
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

function pattern(v: unknown, min: number, max: number): readonly number[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_PATTERN) return null
  const out: number[] = []
  for (const n of v) {
    if (!Number.isInteger(n) || n < min || n > max) return null
    out.push(n)
  }
  return out
}

function musicPlan(v: unknown): MemeMusicPlan | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const style = line(r.style, 32)
  const bpm = r.bpm
  const scale = r.scale
  const bassPattern = pattern(r.bassPattern, -1, 7)
  const leadPattern = pattern(r.leadPattern, -1, 7)
  const drumPattern = pattern(r.drumPattern, 0, 4)
  const intensity = r.intensity

  if (
    !style ||
    typeof bpm !== 'number' ||
    !Number.isInteger(bpm) ||
    bpm < 90 ||
    bpm > 180 ||
    typeof scale !== 'string' ||
    !SCALES.has(scale) ||
    !bassPattern ||
    !leadPattern ||
    !drumPattern ||
    typeof intensity !== 'number' ||
    intensity < 0 ||
    intensity > 1
  ) {
    return null
  }

  return {
    style,
    bpm,
    scale: scale as MusicScale,
    bassPattern,
    leadPattern,
    drumPattern,
    intensity,
  }
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
  const music = musicPlan(r.musicPlan)

  if (!id || !label || palette.length < 2 || palette.length > 4 || !shiftLines || !taunts || !mode || sprites === null || !music) {
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
    musicPlan: music,
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
    musicPlan: MUSIC.Office,
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
    musicPlan: MUSIC.Comment,
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
    musicPlan: MUSIC.Algo,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'FEED BOT', hazard: 'BAIT PIT' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'BOT SWARM', projectile: 'CLICKBAIT' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'AUTO PLAY', hazard: 'SCROLL TRAP' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'FEED BLOCK', projectile: 'BOOST' },
    },
  },
  {
    id: 'six-seven',
    label: 'SIX SEVEN',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#ffe14d', '#3ef0ff', '#ff3ea5'],
    shiftLines: ['SIX SEVEN DETECTED', 'THE NUMBERS MEAN NOTHING AND EVERYTHING'],
    taunts: ['SIX UP SEVEN DOWN', 'BALANCE THE FEED'],
    spritePack: SIX_SEVEN_SPRITES,
    musicPlan: MUSIC.SixSeven,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'UP DOWN', hazard: '👋 ↕ 👋' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'HAND EDIT', projectile: 'SIX SEVEN' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'UP DOWN', hazard: '👋 6 / 7 👋' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: '67 WALL', projectile: 'BOUNCE EDIT' },
    },
  },
  {
    id: 'rizz-circuit',
    label: 'RIZZ CIRCUIT',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#ff3ea5', '#f2eeff', '#4d7cff'],
    shiftLines: ['CHARISMA OVERCLOCKED', 'THE CIRCUIT HAS TOO MUCH RIZZ'],
    taunts: ['SMOOTH INPUT', 'AURA BUFFER FULL'],
    spritePack: RIZZ_SPRITES,
    musicPlan: MUSIC.Rizz,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'AURA BOT', hazard: 'CRINGE FIELD' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'RIZZ DRONE', projectile: 'AURA BEAM' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'VIBE CHECK', hazard: 'AURA TAX' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'AURA WALL', projectile: 'CHARM BALL' },
    },
  },
  {
    id: 'npc-stream',
    label: 'NPC STREAM',
    source: MEME_THEME_SOURCE.Offline,
    date: 'offline',
    palette: ['#4dff9a', '#ffe14d', '#3ef0ff'],
    shiftLines: ['THANK YOU FOR THE LOOP', 'REACTION SCRIPT RELOADED'],
    taunts: ['IDLE ANIMATION WON', 'SCRIPTED BUT DANGEROUS'],
    spritePack: NPC_SPRITES,
    musicPlan: MUSIC.Npc,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'NPC LOOP', hazard: 'SCRIPT BUG' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'STREAM BOT', projectile: 'CHAT PING' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'LOOP CLIP', hazard: 'BIT RUSH' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'CHAT WALL', projectile: 'BIT BALL' },
    },
  },
]

const BUNKER_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '.....oooooo.....',
    '....oDDDDDDo....',
    '...oDkkkkkkDo...',
    '...oDkwwwwkDo...',
    '....oDDDDDDo....',
    '......RRRR......',
    '.....RwwwwR.....',
    '....RRRRRRRR....',
    '...RwwRwwRwwR...',
    '....RRRRRRRR....',
    '.....D....D.....',
    '....DD....DD....',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '....rrrrrrrr....',
    '...rkkkkkkkkr...',
    '..rkrrrrrrrrkr..',
    '..rkrwwwwwwrkr..',
    '..rkrwrrrrwrkr..',
    '..rkrwwwwwwrkr..',
    '..rkrrrrrrrrkr..',
    '...rkkkkkkkkr...',
    '....rrrrrrrr....',
    '......rr........',
    '.....rrrr.......',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....RRRRRRRR....',
    '..RRDDDDDDDDRR..',
    '.RDwwwwwwwwwwDR.',
    '.RDwkwwkkwwkwDR.',
    '.RDwwwwwwwwwwDR.',
    '..RRDDDDDDDDRR..',
    '...RRRRRRRRRR...',
    '....R..RR..R....',
    '...RRR....RRR...',
    '..RR........RR..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '.....rrrrrr.....',
    '....rwwwwwwr....',
    '...rwwkkkwwr....',
    '...rwwwwwwr.....',
    '....rrrrrr......',
    '......rr........',
    '.....rrrr.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..RRRRRRRRRRRR..',
    '.RddddddddddddR.',
    '.RdDDDDDDDDDDdR.',
    '.RdDkkkkkkkkDdR.',
    '.RdDkwwwwwwkDdR.',
    '.RdDkwwwwwwkDdR.',
    '.RdDkkkkkkkkDdR.',
    '.RdDDDDDDDDDDdR.',
    '.RddddddddddddR.',
    '..RRRRRRRRRRRR..',
    '....R......R....',
    '...RR......RR...',
    '................',
    '................',
    '................',
  ],
  brick: [
    'RRRRRRRRRRRRRRRR',
    'RddddddddddddddR',
    'RdDDDDDDDDDDDDdR',
    'RdDkkkkkkkkkkDdR',
    'RdDkwwwwwwwwkDdR',
    'RdDkwwwwwwwwkDdR',
    'RdDkkkkkkkkkkDdR',
    'RdDDDDDDDDDDDDdR',
    'RddddddddddddddR',
    'RRRRRRRRRRRRRRRR',
    'RkkRkkRkkRkkRkkR',
    'RkkRkkRkkRkkRkkR',
    'RRRRRRRRRRRRRRRR',
    'RddddddddddddddR',
    'RddddddddddddddR',
    'RRRRRRRRRRRRRRRR',
  ],
  brickCracked: [
    'RRRRRRRRRRRRRRRR',
    'RddddddrrddddddR',
    'RdDDDDDrRDDDDDdR',
    'RdDkkkrRkkkkkDdR',
    'RdDkwrRwwwwwkDdR',
    'RdDkrRwwwwwwkDdR',
    'RdDkRkkkkkkkkDdR',
    'RdDDRDDDDDDDDDdR',
    'RddrRddddddddddR',
    'RRrRRRRRRRRRRRRR',
    'RrRkkRkkRkkRkkRR',
    'RRRkkRkkRkkRkkRR',
    'RRRRRRRRRRRRRRRR',
    'RddddddddddddddR',
    'RddddddddddddddR',
    'RRRRRRRRRRRRRRRR',
  ],
  ball: [
    '................',
    '.....rrrrrr.....',
    '....rwwwwwwr....',
    '...rwkkkkwwr....',
    '..rwwwwwwwwr....',
    '..rwwrrrrwwr....',
    '..rwwrrrrwwr....',
    '...rwwwwwwr.....',
    '....rrrrrr......',
    '......rr........',
    '.....rrrr.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

const DEBATE_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '.....oooooo.....',
    '....owwwwwwo....',
    '...owkkkkkkwo...',
    '...owkwkkwkwo...',
    '....owwwwwwo....',
    '......BBBB......',
    '.....BwwwwB.....',
    '....BBBBBBBB....',
    '...BwwBwwBwwB...',
    '..BBBBBBBBBBBB..',
    '..BkkkkkkkkkkB..',
    '..BBBBBBBBBBBB..',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '.....mmmmmm.....',
    '....mwwwwwwm....',
    '...mwwkkkkwm....',
    '..mwwwwwwwwm....',
    '..mmmmmmmmmm....',
    '......MM........',
    '.....MMMM.......',
    '....MwwwwM......',
    '....MMMMMM......',
    '.....MMMM.......',
    '......MM........',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....BBBBBBBB....',
    '..BBwwwwwwwwBB..',
    '.BwwkkkkkkkkwwB.',
    '.BwkwwwwwwwwkwB.',
    '.BwwwwwwwwwwwwB.',
    '..BBBBBBBBBBBB..',
    '...B..BBBB..B...',
    '..BBB......BBB..',
    '.B..........B...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '.....mmmmmm.....',
    '....mwwwwwwm....',
    '...mwwkkkkwm....',
    '...mwwwwwwm.....',
    '....mmmmmm......',
    '......MM........',
    '.....MMMM.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..BBBBBBBBBBBB..',
    '.BwwwwwwwwwwwwB.',
    '.BwkkkkkkkkkkwB.',
    '.BwwwwwwwwwwwwB.',
    '..BBBBBBBBBBBB..',
    '....B......B....',
    '....B......B....',
    '..BBBBBBBBBBBB..',
    '..BkkkkkkkkkkB..',
    '..BBBBBBBBBBBB..',
    '...B........B...',
    '..BB........BB..',
    '................',
    '................',
    '................',
  ],
  brick: [
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwwwwwwwwwB',
    'BwkkkkkkkkkkkkwB',
    'BwkwwwwwwwwwwkwB',
    'BwwwwwwwwwwwwwwB',
    'BBBBBBBBBBBBBBBB',
    'BmmmmmmmmmmmmmmB',
    'BmwwwwwwwwwwwwmB',
    'BmkkkkkkkkkkkkmB',
    'BmwwwwwwwwwwwwmB',
    'BmmmmmmmmmmmmmmB',
    'BBBBBBBBBBBBBBBB',
    'BkkkkkkkkkkkkkkB',
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwwwwwwwwwB',
    'BBBBBBBBBBBBBBBB',
  ],
  brickCracked: [
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwmmwwwwwwB',
    'BwkkkkkmMkkkkkwB',
    'BwkwwwmMwwwwwkwB',
    'BwwwwmMwwwwwwwwB',
    'BBBBmMBBBBBBBBBB',
    'BmmmMmmmmmmmmmmB',
    'BmwmMwwwwwwwwwmB',
    'BmkMkkkkkkkkkkmB',
    'BmwMwwwwwwwwwwmB',
    'BmMmmmmmmmmmmmmB',
    'BBMBBBBBBBBBBBBB',
    'BMkkkkkkkkkkkkkB',
    'BBBBBBBBBBBBBBBB',
    'BwwwwwwwwwwwwwwB',
    'BBBBBBBBBBBBBBBB',
  ],
  ball: [
    '................',
    '......MMMM......',
    '.....MwwwwM.....',
    '....MwwkkwM.....',
    '....MwwwwwM.....',
    '.....MMMMM......',
    '......MM........',
    '.....MMMM.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

const TABLOID_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....wwwwww......',
    '...wkkkkkkw.....',
    '..wkwwwwwwkw....',
    '..wkwkkwkkww....',
    '..wkkkkkkkw.....',
    '...wwwwwww......',
    '....dRRRRd......',
    '...dRwwwwRd.....',
    '..dRRRRRRRRd....',
    '..dRwwRRwwRd....',
    '...dRRRRRRd.....',
    '....d....d......',
    '...dd....dd.....',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '....rrrrrrrr....',
    '...rwwwwwwwwr...',
    '..rwkkkkkkwwr...',
    '..rwkrrrrkwr....',
    '..rwkkkkkwr.....',
    '..rwwwwwwr......',
    '..rrrrrrr.......',
    '.....rr.........',
    '....rrrr........',
    '...rr..rr.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....wwwwww......',
    '...wkkkkkkw.....',
    '..wkwwkkwwkw....',
    '..wkwkkkkkww....',
    '..wkkkkkkkw.....',
    '...wwwwwww......',
    '..RRRRRRRRRR....',
    '.RwwRRwwRRwwR...',
    '..RRRRRRRRRR....',
    '...R......R.....',
    '..RR......RR....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '..kkkkkkkkkk....',
    '.kwwwwwwwwwwk...',
    '.kwrrrrrrrrwk...',
    '.kwwwwwwwwwwk...',
    '..kkkkkkkkkk....',
    '.....rr.........',
    '....rrrr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '....wwwwwwww....',
    '...wkkkkkkkkw...',
    '..wkwwwwwwwwkw..',
    '..wkwkkwkkwkw...',
    '..wkkkkkkkkw....',
    '...wwwwwwww.....',
    '..RRRRRRRRRR....',
    '.RwwRRwwRRwwR...',
    '..RRRRRRRRRR....',
    '...R......R.....',
    '..RR......RR....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'yyyyyyyyyyyyyyyy',
    'ywwwwwwwwwwwwwwy',
    'ywkkkkkkkkkkkkwy',
    'ywkrrrrrrrrrrkwy',
    'ywkkkkkkkkkkkkwy',
    'ywwwwwwwwwwwwwwy',
    'yyyyyyyyyyyyyyyy',
    'ykkkkkkkkkkkkkky',
    'ykrkrkrkrkrkrkky',
    'ykkkkkkkkkkkkkky',
    'yyyyyyyyyyyyyyyy',
    'ywwwwwwwwwwwwwwy',
    'ywkkkkkkkkkkkkwy',
    'ywwwwwwwwwwwwwwy',
    'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy',
  ],
  brickCracked: [
    'yyyyyyyyyyyyyyyy',
    'ywwwwwrrwwwwwwwy',
    'ywkkkkrRkkkkkkwy',
    'ywkrRrrrrrrrrkwy',
    'ywkkkRkkkkkkkkwy',
    'ywwwRwwwwwwwwwwy',
    'yyyRyyyyyyyyyyyy',
    'ykRkkkkkkkkkkkky',
    'yRrkrkrkrkrkrkky',
    'ykkkkkkkkkkkkkky',
    'yyyyyyyyyyyyyyyy',
    'ywwwwwwwwwwwwwwy',
    'ywkkkkkkkkkkkkwy',
    'ywwwwwwwwwwwwwwy',
    'yyyyyyyyyyyyyyyy',
    'yyyyyyyyyyyyyyyy',
  ],
  ball: [
    '................',
    '......kkkk......',
    '....kkwwwwkk....',
    '...kwwrrrrwk....',
    '..kwwwwwwwwk....',
    '..kkkkkkkkk.....',
    '.....rr.........',
    '....rrrr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

const STRONGMAN_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '.....BBBBBB.....',
    '....BwwwwwwB....',
    '...BwkwwkwkB....',
    '...BwwkkkkwB....',
    '....BwwwwB......',
    '.....RRRR.......',
    '....RwwwwR......',
    '...RRRRRRRR.....',
    '..RwwRwwRwwR....',
    '...RRRRRRRR.....',
    '....B....B......',
    '...BB....BB.....',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '..BBBBBBBBBBBB..',
    '.BwwwwwwwwwwwwB.',
    '.BwkkwkkwkkwkwB.',
    '.BwwwwwwwwwwwwB.',
    '..BBBBBBBBBBBB..',
    '....R..R..R.....',
    '...RRRRRRRRR....',
    '..RwwwwwwwwwR...',
    '...RRRRRRRRR....',
    '....R..R..R.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....BBBBBBBB....',
    '..BBwwwwwwwwBB..',
    '.BwwkkwwwwkkwwB.',
    '.BwwwwBBBBwwwwB.',
    '..BBBBBBBBBBBB..',
    '...RRRRRRRRRR...',
    '..RwwRwwwwRwwR..',
    '...RRRRRRRRRR...',
    '....R......R....',
    '...RR......RR...',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '...BBBBBBBB.....',
    '..BwwwwwwwwB....',
    '.BwwkkkkkkwB....',
    '..BwwwwwwB......',
    '...BBBBBB.......',
    '.....RR.........',
    '....RRRR........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '..RRRRRRRRRRRR..',
    '.RwwwwwwwwwwwwR.',
    '.RwBBBBBBBBBBwR.',
    '.RwBwwwwwwwwBwR.',
    '.RwBwkwwkwkwBwR.',
    '.RwBwwwwwwwwBwR.',
    '.RwBBBBBBBBBBwR.',
    '.RwwwwwwwwwwwwR.',
    '..RRRRRRRRRRRR..',
    '....B......B....',
    '...BBB....BBB...',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'BBBBBBBBRRRRRRRR',
    'BwwwwwwBRwwwwwwR',
    'BwkkkkwBRwkkkkwR',
    'BwkwwkwBRwkwkwkR',
    'BwwwwwwBRwwwwwwR',
    'BBBBBBBBRRRRRRRR',
    'RRRRRRRRBBBBBBBB',
    'RwwwwwwRBwwwwwwB',
    'RwkkkkwRBwkkkkwB',
    'RwkwkwkRBwkwwkwB',
    'RwwwwwwRBwwwwwwB',
    'RRRRRRRRBBBBBBBB',
    'BBBBBBBBRRRRRRRR',
    'BwwwwwwBRwwwwwwR',
    'BBBBBBBBRRRRRRRR',
    'RRRRRRRRBBBBBBBB',
  ],
  brickCracked: [
    'BBBBBBBBRRRRRRRR',
    'BwwwrrwBRwwwrrwR',
    'BwkkrrwBRwkkrrwR',
    'BwkwrkwBRwkrkwkR',
    'BwwwrwwBRwwrwwwR',
    'BBBBRBBBRRRRrRRR',
    'RRRrRRRRBBBBRBBB',
    'RwwRwwwRBwwwrwwB',
    'RwkRkkwRBwkkRkwB',
    'RwkRkwkRBwkwRkwB',
    'RwwRwwwRBwwwRwwB',
    'RRRRRRRRBBBBBBBB',
    'BBBBBBBBRRRRRRRR',
    'BwwwwwwBRwwwwwwR',
    'BBBBBBBBRRRRRRRR',
    'RRRRRRRRBBBBBBBB',
  ],
  ball: [
    '................',
    '.....BBBBBB.....',
    '....BwwwwwwB....',
    '...BwkkkkwwB....',
    '..BwwwwwwwwB....',
    '..BBBBBBBBB.....',
    '.....RR.........',
    '....RRRR........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

const MAGA_SPRITES: MemeSpritePack = {
  platformerEnemy: [
    '................',
    '....B.....B.....',
    '...Bww...Bww....',
    '..BwwwwBBwwwB...',
    '.BwwwwwwwwwwB...',
    '.BwkwwwwwwkwB...',
    '.BwwwwkwkwwwB...',
    '..BBBBwwwwwwB...',
    '.....BBBBBBBB...',
    '......B....B....',
    '.....BB...BB....',
    '....BB....BB....',
    '................',
    '................',
    '................',
    '................',
  ],
  platformerHazard: [
    '................',
    '..rrrrrrrrrrrr..',
    '.rwwwwwwwwwwwwr.',
    '.rwkkkkkkkkkkwr.',
    '.rwwwwwwwwwwwwr.',
    '..rrrrrrrrrrrr..',
    '.....r....r.....',
    '....rr....rr....',
    '...rr......rr...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterEnemy: [
    '................',
    '....B.....B.....',
    '...Bww...Bww....',
    '..BwwwwBBwwwB...',
    '.BwwwwwwwwwwB...',
    '.BwkwwwwwwkwB...',
    '.BwwwwkwkwwwB...',
    '..BBBBwwwwwwB...',
    '.....BBBBBBBB...',
    '......B....B....',
    '.....BB...BB....',
    '....BB....BB....',
    '................',
    '................',
    '................',
    '................',
  ],
  shooterProjectile: [
    '................',
    '................',
    '...rrrrrrrr.....',
    '..rwwwwwwwwr....',
    '.rwkkkkkkwwr....',
    '..rwwwwwwr......',
    '...rrrrrr.......',
    '.....rr.........',
    '....rrrr........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  runnerObstacle: [
    '................',
    '....B.....B.....',
    '...Bww...Bww....',
    '..BwwwwBBwwwB...',
    '.BwwwwwwwwwwB...',
    '.BwkwwwwwwkwB...',
    '.BwwwwkwkwwwB...',
    '..BBBBwwwwwwB...',
    '.....BBBBBBBB...',
    '......B....B....',
    '.....BB...BB....',
    '....BB....BB....',
    '................',
    '................',
    '................',
    '................',
  ],
  brick: [
    'DDDDDDDDDDDDDDDD',
    'DwwwwwwwwwwwwwwD',
    'DwDDDDDDDDDDDDwD',
    'DwDwwwwwwwwwwDwD',
    'DwDDDDDDDDDDDDwD',
    'DwwwwwwwwwwwwwwD',
    'DDDDDDDDDDDDDDDD',
    'DWWWWWWWWWWWWWWD',
    'DWDWDWDWDWDWDWDD',
    'DWWWWWWWWWWWWWWD',
    'DDDDDDDDDDDDDDDD',
    'DwwwwwwwwwwwwwwD',
    'DwDDDDDDDDDDDDwD',
    'DwwwwwwwwwwwwwwD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  brickCracked: [
    'DDDDDDDDDDDDDDDD',
    'DwwwwwrrwwwwwwwD',
    'DwDDDDDrRDDDDDwD',
    'DwDwwwrRwwwwwDwD',
    'DwDDDDrRDDDDDDwD',
    'DwwwwRwwwwwwwwwD',
    'DDDDDrDDDDDDDDDD',
    'DWWWWRWWWWWWWWWD',
    'DWDWDrDWDWDWDWDD',
    'DWWWrWWWWWWWWWWD',
    'DDDrDDDDDDDDDDDD',
    'DwwRwwwwwwwwwwwD',
    'DwRDDDDDDDDDDDwD',
    'DwwwwwwwwwwwwwwD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  ball: [
    '................',
    '.....rrrrrr.....',
    '....rwwwwwwr....',
    '...rwkkkkwwr....',
    '..rwwwoowwwr....',
    '..rwwwwwwwwr....',
    '...rrrrrrrr.....',
    '.....BB.........',
    '....BBBB........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

export const ADULT_MEME_THEMES: readonly MemeTheme[] = [
  {
    id: 'bunker-posting',
    label: 'BUNKER POSTING',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#ff4d4d', '#ffe14d', '#3ef0ff'],
    shiftLines: ['THE BUNKER HAS WIFI AGAIN', 'SADDAM FOUND THE ROUTER ROOM'],
    taunts: ['BUNKER CAM LOST SIGNAL', 'HISTORY CHANNEL COMMENTS ARE LIVE'],
    spritePack: BUNKER_SPRITES,
    musicPlan: MUSIC.Comment,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'SADDAM CAM', hazard: 'HOT MIC' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'WAR ROOM', projectile: 'PRESS CLIP' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'BUNKER DOOR', hazard: 'BAD BRIEF' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'BUNKER WALL', projectile: 'CLIP BALL' },
    },
  },
  {
    id: 'debate-afterparty',
    label: 'DEBATE AFTERPARTY',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#4d7cff', '#ff3ea5', '#f2eeff'],
    shiftLines: ['THE PANEL HAS LOST THE PLOT', 'HOT TAKES NEED A PERMIT'],
    taunts: ['CHARLIE KIRK CLIP FARM', 'THE MIC STAYED ON'],
    spritePack: DEBATE_SPRITES,
    musicPlan: MUSIC.Rizz,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'PODIUM GUY', hazard: 'CLIP FARM' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'DEBATE DRONE', projectile: 'SOUND BITE' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'PANEL DESK', hazard: 'HOT SEAT' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'TAKE WALL', projectile: 'MIC DROP' },
    },
  },
  {
    id: 'tabloid-island',
    label: 'TABLOID ISLAND',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#ffe14d', '#ff4d4d', '#f2eeff'],
    shiftLines: ['EPSTEIN FILES GOT ARCADE PHYSICS', 'REDACTED FOLDER STARTED BLINKING'],
    taunts: ['TABLOID BOARD NEEDS STRING', 'CAMERA ROLL DENIED'],
    spritePack: TABLOID_SPRITES,
    musicPlan: MUSIC.Algo,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'FILE CLERK', hazard: 'REDACTED' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'CAM DRONE', projectile: 'FILE TAB' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'CASE FILE', hazard: 'RED TAPE' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'FILE WALL', projectile: 'TABLOID' },
    },
  },
  {
    id: 'war-room-absurd',
    label: 'WAR ROOM ABSURD',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#ffe14d', '#4dff9a', '#ff4d4d'],
    shiftLines: ['THE MAP TABLE STARTED POSTING', 'TACTICAL BRAINROT DEPLOYED'],
    taunts: ['GENERAL CHAT HAS FALLEN', 'THE BRIEFING WAS A MEME'],
    spritePack: STRONGMAN_SPRITES,
    musicPlan: MUSIC.SixSeven,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'PUTIN MAP', hazard: 'RED STRING' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'BRIEFING BOT', projectile: 'MEMO BLAST' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'MAP TABLE', hazard: 'ALARM LOOP' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'WAR BOARD', projectile: 'PLAN BALL' },
    },
  },
  {
    id: 'strongman-feed',
    label: 'STRONGMAN FEED',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#4d7cff', '#ff4d4d', '#ffe14d'],
    shiftLines: ['ERDOGAN AND PUTIN ENTERED THE NEWSROOM', 'THE MAP TABLE STARTED POSTING'],
    taunts: ['KREMLIN BOT MISSED', 'PRESS ROOM BUFFERING'],
    spritePack: STRONGMAN_SPRITES,
    musicPlan: MUSIC.Comment,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'PODIUM BOT', hazard: 'MAP LOOP' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'KREMLIN BOT', projectile: 'NEWS BLIP' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'MAP TABLE', hazard: 'HOT BRIEF' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'NEWS WALL', projectile: 'MAP PIN' },
    },
  },
  {
    id: 'maga-rally',
    label: 'MAGA RALLY',
    source: MEME_THEME_SOURCE.Offline,
    date: 'adult',
    palette: ['#ff4d4d', '#4d7cff', '#f2eeff'],
    shiftLines: ['TRUMP RALLY SIGNS FOUND THE HITBOXES', 'MAGA PROJECTILES ONLINE'],
    taunts: ['MAGA SIGN WHIFFED', 'PODIUM BUFFERING'],
    spritePack: MAGA_SPRITES,
    musicPlan: MUSIC.SixSeven,
    modeFlavor: {
      [MODE.Platformer]: { ...DEFAULT_FLAVOR, enemy: 'MAGA', hazard: 'RALLY SIGN' },
      [MODE.Shooter]: { ...DEFAULT_FLAVOR, enemy: 'DONKEY', projectile: 'MAGA' },
      [MODE.Runner]: { ...DEFAULT_FLAVOR, obstacle: 'MAGA SIGN', hazard: 'RALLY' },
      [MODE.Brick]: { ...DEFAULT_FLAVOR, brick: 'MAGA WALL', projectile: 'CAP BALL' },
    },
  },
]

export function offlineMemeThemeForDate(date = localDateKey()): MemeTheme {
  const n = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const base = OFFLINE_MEME_THEMES[n % OFFLINE_MEME_THEMES.length]
  return { ...base, date, source: MEME_THEME_SOURCE.Offline }
}

export const OFFLINE_MEME_THEME_IDS: readonly string[] = OFFLINE_MEME_THEMES.map((t) => t.id)
export const ADULT_MEME_THEME_IDS: readonly string[] = ADULT_MEME_THEMES.map((t) => t.id)

export function offlineMemeThemeById(id: string | null | undefined, date = localDateKey()): MemeTheme | null {
  if (!id) return null
  const base = OFFLINE_MEME_THEMES.find((t) => t.id === id)
  return base ? { ...base, date, source: MEME_THEME_SOURCE.Offline } : null
}

export function adultMemeThemeForDate(date = localDateKey()): MemeTheme {
  const n = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const base = ADULT_MEME_THEMES[n % ADULT_MEME_THEMES.length]
  return { ...base, date, source: MEME_THEME_SOURCE.Offline }
}

export function adultMemeThemeById(id: string | null | undefined, date = localDateKey()): MemeTheme | null {
  if (!id) return null
  const base = ADULT_MEME_THEMES.find((t) => t.id === id)
  return base ? { ...base, date, source: MEME_THEME_SOURCE.Offline } : null
}

export function memeAccent(theme: MemeTheme, index: number, fallback = '#3ef0ff'): string {
  return theme.palette[index % theme.palette.length] ?? fallback
}

export function memeAccentNumber(theme: MemeTheme, index: number, fallback = 0x3ef0ff): number {
  const c = memeAccent(theme, index)
  return HEX.test(c) ? Number.parseInt(c.slice(1), 16) : fallback
}
