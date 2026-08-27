import type Phaser from 'phaser'
import { drawSprite, makeCanvas } from './pixels.ts'
import type { PixelSprite } from './pixels.ts'
import {
  BALL,
  BRICK,
  BRICK_CRACKED,
  CHIP,
  CROWN,
  DOOR_LOCKED,
  DOOR_OPEN,
  FIRE_0,
  FIRE_1,
  FLYER_0,
  FLYER_1,
  GEM,
  GUNSHIP_0,
  GUNSHIP_1,
  OBSTACLE_BLOCK,
  PLAYER_FALL,
  PLAYER_HURT,
  PLAYER_IDLE,
  PLAYER_JUMP,
  PLAYER_SLIDE,
  PLAYER_WALK_0,
  PLAYER_WALK_1,
  PLAYER_WALK_2,
  PLAYER_WALK_3,
  SHIP_0,
  SHIP_1,
  SHOT_ENEMY,
  SHOT_PLAYER,
  SPIKE,
  TILE_BRICK,
  TILE_GIRDER,
  TILE_STONE,
  TROPHY,
  WALKER_0,
  WALKER_1,
} from './sprites.ts'

export const ATLAS_KEY = 'atlas'

const CELL = 16
const COLS = 8

interface FrameDef {
  readonly name: string
  readonly sprite: PixelSprite
}

/**
 * Frame names are the single source of truth for every `scene.add.sprite(x, y,
 * ATLAS_KEY, <name>)` call in the game. Adding art is one entry here plus the
 * PixelSprite const it points at.
 */
const FRAMES: readonly FrameDef[] = [
  // shared avatar (platformer + runner)
  { name: 'player-idle', sprite: PLAYER_IDLE },
  { name: 'player-walk-0', sprite: PLAYER_WALK_0 },
  { name: 'player-walk-1', sprite: PLAYER_WALK_1 },
  { name: 'player-walk-2', sprite: PLAYER_WALK_2 },
  { name: 'player-walk-3', sprite: PLAYER_WALK_3 },
  { name: 'player-jump', sprite: PLAYER_JUMP },
  { name: 'player-fall', sprite: PLAYER_FALL },
  { name: 'player-hurt', sprite: PLAYER_HURT },
  { name: 'player-slide', sprite: PLAYER_SLIDE },
  // terrain
  { name: 'tile-brick', sprite: TILE_BRICK },
  { name: 'tile-stone', sprite: TILE_STONE },
  { name: 'tile-girder', sprite: TILE_GIRDER },
  // pickups
  { name: 'chip', sprite: CHIP },
  { name: 'gem', sprite: GEM },
  { name: 'crown', sprite: CROWN },
  { name: 'trophy', sprite: TROPHY },
  { name: 'door-locked', sprite: DOOR_LOCKED },
  { name: 'door-open', sprite: DOOR_OPEN },
  // hazards & platformer enemies
  { name: 'spike', sprite: SPIKE },
  { name: 'fire-0', sprite: FIRE_0 },
  { name: 'fire-1', sprite: FIRE_1 },
  { name: 'walker-0', sprite: WALKER_0 },
  { name: 'walker-1', sprite: WALKER_1 },
  { name: 'flyer-0', sprite: FLYER_0 },
  { name: 'flyer-1', sprite: FLYER_1 },
  // shooter
  { name: 'ship-0', sprite: SHIP_0 },
  { name: 'ship-1', sprite: SHIP_1 },
  { name: 'gunship-0', sprite: GUNSHIP_0 },
  { name: 'gunship-1', sprite: GUNSHIP_1 },
  { name: 'shot-player', sprite: SHOT_PLAYER },
  { name: 'shot-enemy', sprite: SHOT_ENEMY },
  // runner
  { name: 'obstacle', sprite: OBSTACLE_BLOCK },
  // breakout -- no paddle frame, it's a Phaser Rectangle, not a sprite
  { name: 'ball', sprite: BALL },
  { name: 'brick', sprite: BRICK },
  { name: 'brick-cracked', sprite: BRICK_CRACKED },
]

/**
 * Draws every FRAMES entry into one offscreen canvas, registers it as a
 * single texture, and slices named frames out of it. Guarded against
 * StrictMode's mount -> unmount -> mount so it only runs once per texture
 * key even if BootScene.create() runs twice.
 */
export function buildAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS_KEY)) return

  if (import.meta.env.DEV) assertFrameSizes()

  const rows = Math.ceil(FRAMES.length / COLS)
  const canvas = makeCanvas(COLS * CELL, rows * CELL)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable while building atlas')
  ctx.imageSmoothingEnabled = false

  FRAMES.forEach((f, i) => {
    drawSprite(ctx, f.sprite, (i % COLS) * CELL, Math.floor(i / COLS) * CELL)
  })

  const tex = scene.textures.addCanvas(ATLAS_KEY, canvas)
  if (!tex) throw new Error('Failed to register atlas canvas texture')

  FRAMES.forEach((f, i) => {
    tex.add(f.name, 0, (i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL)
  })
}

/**
 * A row that is one char short silently shifts every pixel after it, which
 * shows up as art that looks subtly "sheared" rather than as an error. Cheap
 * to check, and only in dev.
 */
function assertFrameSizes(): void {
  for (const f of FRAMES) {
    if (f.sprite.length > CELL) {
      throw new Error(`Sprite "${f.name}" has ${f.sprite.length} rows, max ${CELL}`)
    }
    for (const [y, row] of f.sprite.entries()) {
      if (row.length !== CELL) {
        throw new Error(
          `Sprite "${f.name}" row ${y} is ${row.length} chars, expected ${CELL}`,
        )
      }
    }
  }
}
