import type { PixelSprite } from './pixels.ts'

/**
 * Every frame is 16x16. One char per pixel, indexed into PALETTE; '.' is
 * transparent. Only left-facing art is drawn — right-facing uses
 * setFlipX(true) at the call site.
 */

// --- Player -----------------------------------------------------------

const TORSO = [
  '................',
  '.....yyyyy......',
  '....yyyyyyy.....',
  '....yffffyy.....',
  '....yfkfkfy.....',
  '....offfffo.....',
  '.....offfo......',
  '....bbbbbbb.....',
  '...bbrbbbrbb....',
  '...bbbbbbbbb....',
]

const LEGS_STANDING = [
  '....ffb.bff.....',
  '.....bb.bb......',
  '.....bb.bb......',
  '.....bb.bb......',
  '....MMM.MMM.....',
  '...MMMM.MMMM....',
]

// Walk cycle: alternate which leg is planted (long) vs bent (short, boot
// pulled up). Rows 0-2 (thighs) stay put; only the boot rows change.
const LEGS_WALK_A = [
  '....ffb.bff.....',
  '.....bb.bb......',
  '.....bb.bb......',
  '.....bb.MM......',
  '....MMM.........',
  '...MMMM.........',
]

const LEGS_WALK_B = [
  '....ffb.bff.....',
  '.....bb.bb......',
  '.....bb.bb......',
  '.....MM.bb......',
  '.........MMM....',
  '.........MMMM...',
]

const LEGS_TUCKED = [
  '....ffb.bff.....',
  '.....MM.MM......',
  '.....MM.MM......',
  '.....MM.MM......',
  '................',
  '................',
]

const LEGS_SPREAD = [
  '..ffb.....bff...',
  '...bb.....bb....',
  '..bb.......bb...',
  '.bb.........bb..',
  '.MM.........MM..',
  'MM............MM',
]

export const PLAYER_IDLE: PixelSprite = [...TORSO, ...LEGS_STANDING]
export const PLAYER_WALK_0: PixelSprite = [...TORSO, ...LEGS_WALK_A]
export const PLAYER_WALK_1: PixelSprite = [...TORSO, ...LEGS_STANDING]
export const PLAYER_WALK_2: PixelSprite = [...TORSO, ...LEGS_WALK_B]
export const PLAYER_WALK_3: PixelSprite = [...TORSO, ...LEGS_STANDING]
export const PLAYER_JUMP: PixelSprite = [...TORSO, ...LEGS_TUCKED]
export const PLAYER_FALL: PixelSprite = [...TORSO, ...LEGS_SPREAD]

const TORSO_HURT = [
  '................',
  '.....yyyyy......',
  '....yyyyyyy.....',
  '....rffffrr.....',
  '....rfkfkfr.....',
  '....offfffo.....',
  '.....offfo......',
  '....rrrrrrr.....',
  '...rrrrrrrrr....',
  '...rrrrrrrrr....',
]
export const PLAYER_HURT: PixelSprite = [...TORSO_HURT, ...LEGS_SPREAD]

// --- Tiles --------------------------------------------------------------

export const TILE_BRICK: PixelSprite = [
  'dmmmmmmmdmmmmmmm',
  'dmmmmmmmdmmmmmmm',
  'dmmmmmmmdmmmmmmm',
  'dddddddddddddddd',
  'mmmmdmmmmmmmdmmm',
  'mmmmdmmmmmmmdmmm',
  'mmmmdmmmmmmmdmmm',
  'dddddddddddddddd',
  'dmmmmmmmdmmmmmmm',
  'dmmmmmmmdmmmmmmm',
  'dmmmmmmmdmmmmmmm',
  'dddddddddddddddd',
  'mmmmdmmmmmmmdmmm',
  'mmmmdmmmmmmmdmmm',
  'mmmmdmmmmmmmdmmm',
  'dddddddddddddddd',
]

export const TILE_STONE: PixelSprite = [
  'DWWWWWWWWWWWWWWD',
  'DWWdWWWWWWWdWWWD',
  'DWWWWWWWWWWWWWWD',
  'DWWWWdWWWWWWWWWD',
  'DDDDDDDDDDDDDDDD',
  'DWWWWWWdWWWWWWWD',
  'DWWWWWWWWWdWWWWD',
  'DWWWWWWWWWWWWWWD',
  'DDDDDDDDDDDDDDDD',
  'DWdWWWWWWWWWWWWD',
  'DWWWWWWWWWWdWWWD',
  'DWWWWWWWWWWWWWWD',
  'DDDDDDDDDDDDDDDD',
  'DWWWWWWWdWWWWWWD',
  'DWWWWWWWWWWWWWWD',
  'DDDDDDDDDDDDDDDD',
]

export const TILE_GIRDER: PixelSprite = [
  'DDDDDDDDDDDDDDDD',
  'DwwwwwwwwwwwwwwD',
  'DwDDDDDDDDDDDDwD',
  'DwDkDDDDDDDDkDwD',
  'DwDDDDDDDDDDDDwD',
  'DwDDDDDDDDDDDDwD',
  'DwDDDDDDDDDDDDwD',
  'DwDkDDDDDDDDkDwD',
  'DwDDDDDDDDDDDDwD',
  'DwDDDDDDDDDDDDwD',
  'DwDDDDDDDDDDDDwD',
  'DwDkDDDDDDDDkDwD',
  'DwDDDDDDDDDDDDwD',
  'DwDDDDDDDDDDDDwD',
  'DwwwwwwwwwwwwwwD',
  'DDDDDDDDDDDDDDDD',
]

// --- Collectibles ---------------------------------------------------------

export const GEM: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '.......cc.......',
  '......cwcc......',
  '.....cccccc.....',
  '....cccccccc....',
  '.....cccccc.....',
  '......cccc......',
  '.......cc.......',
  '................',
  '................',
  '................',
  '................',
  '................',
]

export const CROWN: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '..y....y....y...',
  '..yy...yy..yy...',
  '..yyy.yyyy.yyy..',
  '..yyyyyyyyyyyy..',
  '..yrryyyyyryyy..',
  '..yyyyyyyyyyyy..',
  '..yyyyyyyyyyyy..',
  '................',
  '................',
  '................',
  '................',
  '................',
]

export const TROPHY: PixelSprite = [
  '................',
  '................',
  '...yyyyyyyyyy...',
  '..yyyyyyyyyyyy..',
  '..yywwwwwwwwyy..',
  '..yywwwwwwwwyy..',
  '...yyywwwwyyy...',
  '.....yyyyyy.....',
  '......yyyy......',
  '......yyyy......',
  '.....yyyyyy.....',
  '....yyyyyyyy....',
  '................',
  '................',
  '................',
  '................',
]

// --- Door -----------------------------------------------------------------

export const DOOR_LOCKED: PixelSprite = [
  'MMMMMMMMMMMMMMMM',
  'MdddddddddddddM.',
  'MdkkkkkkkkkkkdM.',
  'MdkoooooooookdM.',
  'MdkoooooooookdM.',
  'MdkoooooooookdM.',
  'MdkoorrroookdM..',
  'MdkoorrroookdM..',
  'MdkoooooooookdM.',
  'MdkoooooooookdM.',
  'MdkoooooooookdM.',
  'MdkoooooooookdM.',
  'MdkoooooooookdM.',
  'MdkoooooooookdM.',
  'MdddddddddddddM.',
  'MMMMMMMMMMMMMMMM',
]

export const DOOR_OPEN: PixelSprite = [
  'MMMMMMMMMMMMMMMM',
  'MdddddddddddddM.',
  'MdkkkkkkkkkkkdM.',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'Mdkkkkkkkkkkkd M',
  'MdddddddddddddM.',
  'MMMMMMMMMMMMMMMM',
]

// --- Hazards ----------------------------------------------------------

export const SPIKE: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..W....W....W...',
  '.WWW..WWW..WWW..',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD',
]

export const FIRE_0: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......y........',
  '......yoy.......',
  '.....yoror......',
  '.....rorroy.....',
  '.....orrroy.....',
  '....orooroo.....',
]

export const FIRE_1: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......y..y......',
  '.....yoy.oy.....',
  '.....orory......',
  '....yoorroy.....',
  '....orrrroy.....',
  '....orroroo.....',
  '....orooroo.....',
]

// --- Enemies ------------------------------------------------------------

export const WALKER_0: PixelSprite = [
  '................',
  '................',
  '................',
  '....rrrrrrr.....',
  '...rrrrrrrrr....',
  '..rrkrrrrrkrr...',
  '..rrrrrrrrrrr...',
  '..rrRRRRRRRrr...',
  '...rRRRRRRRr....',
  '...rRRRRRRRr....',
  '....RRRRRRR.....',
  '....RR...RR.....',
  '....RR...RR.....',
  '...RRR...RRR....',
  '................',
  '................',
]

export const WALKER_1: PixelSprite = [
  '................',
  '................',
  '................',
  '....rrrrrrr.....',
  '...rrrrrrrrr....',
  '..rrkrrrrrkrr...',
  '..rrrrrrrrrrr...',
  '..rrRRRRRRRrr...',
  '...rRRRRRRRr....',
  '...rRRRRRRRr....',
  '....RRRRRRR.....',
  '...RRR...RRR....',
  '...RR.....RR....',
  '...RR.....RR....',
  '................',
  '................',
]

export const FLYER_0: PixelSprite = [
  '................',
  '................',
  '..bb.......bb...',
  '.bbbb.....bbbb..',
  'bbbbbb...bbbbbb.',
  '.bbbb.....bbbb..',
  '..bb..BBB..bb...',
  '.....BwkwB......',
  '.....BBBBB......',
  '......BBB.......',
  '......BBB.......',
  '................',
  '................',
  '................',
  '................',
  '................',
]

export const FLYER_1: PixelSprite = [
  '................',
  '................',
  '................',
  '...bb.....bb....',
  '..bbbb...bbbb...',
  '.bbbbbb.bbbbbb..',
  '..bb..BBB..bb...',
  '.....BwkwB......',
  '.....BBBBB......',
  '......BBB.......',
  '......BBB.......',
  '................',
  '................',
  '................',
  '................',
  '................',
]

// --- Shooter mode -----------------------------------------------------
// The shooter is side-scrolling, so the player ship points right and enemy
// gunships point left. Two frames each, differing only in the engine/core
// colour, which reads as a flicker at 12fps.

const SHIP_BODY = (engine: string): PixelSprite => [
  '................',
  '................',
  '........c.......',
  '.......cc.......',
  '....CCCcccc.....',
  '...CCCccccccc...',
  `..${engine}${engine}CCCcccccccc.`,
  `..${engine}${engine}${engine}CCCCcccccc.`,
  `..${engine}${engine}CCCcccccccc.`,
  '...CCCccccccc...',
  '....CCCcccc.....',
  '.......cc.......',
  '........c.......',
  '................',
  '................',
  '................',
]

export const SHIP_0: PixelSprite = SHIP_BODY('m')
export const SHIP_1: PixelSprite = SHIP_BODY('o')

const GUNSHIP_BODY = (core: string): PixelSprite => [
  '................',
  '................',
  '.......r........',
  '.......rr.......',
  '.....rrrrRRR....',
  '...rrrrrrrRRR...',
  `.rrrrrrrrrRR${core}${core}..`,
  `.rrrrrrrrrrR${core}${core}${core}.`,
  `.rrrrrrrrrRR${core}${core}..`,
  '...rrrrrrrRRR...',
  '.....rrrrRRR....',
  '.......rr.......',
  '.......r........',
  '................',
  '................',
  '................',
]

export const GUNSHIP_0: PixelSprite = GUNSHIP_BODY('m')
export const GUNSHIP_1: PixelSprite = GUNSHIP_BODY('y')

export const SHOT_PLAYER: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....ccwwwwcc....',
  '....ccwwwwcc....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

export const SHOT_ENEMY: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......mmmm......',
  '.....mrrrrm.....',
  '.....mrrrrm.....',
  '......mmmm......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

// --- Shared pickups & runner ------------------------------------------

/** Data chip: the universal score pickup, used by all three modes. */
export const CHIP: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '....cccccccc....',
  '....cwwwwwwc....',
  '....cwCCCCwc....',
  '....cwCwwCwc....',
  '....cwCwwCwc....',
  '....cwCCCCwc....',
  '....cwwwwwwc....',
  '....cccccccc....',
  '................',
  '................',
  '................',
  '................',
]

/** Runner obstacle. Positioned high (slide under) or low (jump over). */
export const OBSTACLE_BLOCK: PixelSprite = [
  'mmmmmmmmmmmmmmmm',
  'mMMMMMMMMMMMMMMm',
  'mMddddddddddddMm',
  'mMdrddddddddrdMm',
  'mMddrddddddrddMm',
  'mMdddrddddrdddMm',
  'mMddddrddrddddMm',
  'mMdddddrrdddddMm',
  'mMdddddrrdddddMm',
  'mMddddrddrddddMm',
  'mMdddrddddrdddMm',
  'mMddrddddddrddMm',
  'mMdrddddddddrdMm',
  'mMddddddddddddMm',
  'mMMMMMMMMMMMMMMm',
  'mmmmmmmmmmmmmmmm',
]

/** Crouched pose for the runner's slide. */
export const PLAYER_SLIDE: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......ccccc....',
  '......cffffcc...',
  '.....mfkfkfc....',
  '....bbbbbfffm...',
  '...bbmbbbbbb....',
  '...MMbbbbbbM....',
  '....MMM..MMM....',
  '................',
]

// --- Breakout mode ------------------------------------------------------
// BREAKDOWN's paddle is a Phaser Rectangle, not a sprite -- it needs no art
// here. The ball and the two brick states are the whole of this section.

/** The ball: a filled circle roughly matching BALL_R's 3px physics radius,
 *  drawn a touch larger so it reads clearly against the wall and paddle. */
export const BALL: PixelSprite = [
  '................',
  '................',
  '................',
  '................',
  '......CCCC......',
  '.....CccccC.....',
  '....CccwcccC....',
  '....CcwwcccC....',
  '....CccccccC....',
  '....CccccccC....',
  '.....CccccC.....',
  '......CCCC......',
  '................',
  '................',
  '................',
  '................',
]

/**
 * A single brick, at full health. Drawn at setScale(2, 1) in the scene, so
 * only horizontal detail gets stretched -- the bevel is what survives that:
 * a bright top/left edge, a dark bottom/right edge, and a mortar course
 * through the middle so it still reads as "brick" rather than "button".
 */
export const BRICK: PixelSprite = [
  'mmmmmmmmmmmmmmmm',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mkkkkkkkkkkkkkkM',
  'mkkkkkkkkkkkkkkM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mMMMMMMMMMMMMMMM',
]

/**
 * The same brick after its first hit -- a visible fracture, so a two-hit
 * brick reads as "about to break" rather than looking untouched.
 *
 * The crack is 'k' (near-black, #08060f) against the 'd' fill (#1b1830) --
 * genuinely darker, so it reads as a shadowed fracture. The first attempt
 * used 'D' (#3b3560), which is LIGHTER than the fill: backwards for a crack,
 * and too low-contrast to read at gameplay scale. Two pixels wide so it
 * survives the scene's setScale(2, 1) stretch.
 */
export const BRICK_CRACKED: PixelSprite = [
  'mmmmmmmmmmmmmmmm',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mdkkkdddkddddddM',
  'mddkkkddkddddddM',
  'mdddkkkddkdddddM',
  'mddddkkkdkdddddM',
  'mkkkkkkkkkkkkkkM',
  'mkkkkkkkkkkkkkkM',
  'mddddddddkkkdddM',
  'mdddddddddkkkddM',
  'mddddddddddkkkdM',
  'mdddddddddddkkkM',
  'mddddddddddddddM',
  'mddddddddddddddM',
  'mMMMMMMMMMMMMMMM',
]
