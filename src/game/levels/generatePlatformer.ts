import { TILE_SIZE, VIEW_H } from '../constants.ts'
import { chance, makeRng, randInt } from '../rng.ts'
import type { Rng } from '../rng.ts'

/**
 * Stages are generated rather than authored. A mode-shift game hands the
 * player a new platformer every couple of minutes, so hand-built levels would
 * be both a bottleneck and unable to respond to the director's
 * spawnRateScale. The seed keeps a bad layout reproducible.
 */
export const ROWS = Math.floor(VIEW_H / TILE_SIZE) // 12
export const COLS = 140
const GROUND_ROW = ROWS - 2

export const SOLID = {
  None: 0,
  Ground: 1,
  Platform: 2,
} as const
export type SolidKind = (typeof SOLID)[keyof typeof SOLID]

export const SPAWN = {
  Spike: 'spike',
  Fire: 'fire',
  Walker: 'walker',
  Flyer: 'flyer',
  Chip: 'chip',
} as const
export type SpawnKind = (typeof SPAWN)[keyof typeof SPAWN]

export interface Spawn {
  readonly kind: SpawnKind
  /** Pixel centre. */
  readonly x: number
  readonly y: number
  /** Patrol half-width in px, for walkers/flyers. */
  readonly range: number
}

export interface PlatformerLevel {
  readonly grid: readonly (readonly SolidKind[])[]
  readonly spawns: readonly Spawn[]
  readonly startX: number
  readonly startY: number
  readonly widthPx: number
  readonly heightPx: number
  readonly seed: number
}

const tileCentre = (col: number, row: number) => ({
  x: col * TILE_SIZE + TILE_SIZE / 2,
  y: row * TILE_SIZE + TILE_SIZE / 2,
})

export function generatePlatformer(seed: number, spawnRateScale: number): PlatformerLevel {
  const rng = makeRng(seed)
  const grid: SolidKind[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => SOLID.None),
  )
  const spawns: Spawn[] = []

  // --- ground, punctuated by pits -------------------------------------
  // Tracks which columns are walkable so hazards and enemies are never
  // placed floating over a pit.
  const solidGround: boolean[] = Array.from({ length: COLS }, () => true)

  let col = 0
  // The first 8 columns are always solid: the player must never spawn onto
  // a pit edge, whatever the seed.
  while (col < COLS) {
    const runLength = randInt(rng, 6, 14)
    for (let i = 0; i < runLength && col < COLS; i++, col++) {
      grid[GROUND_ROW][col] = SOLID.Ground
      grid[GROUND_ROW + 1][col] = SOLID.Ground
    }
    if (col > 8 && col < COLS - 10) {
      const pit = randInt(rng, 2, 3)
      for (let i = 0; i < pit && col < COLS; i++, col++) solidGround[col] = false
    }
  }

  // --- floating platforms ---------------------------------------------
  // Rows 5-8 only: reachable from the ground with the tuned jump arc
  // (apex ~50px ≈ 3.1 tiles), and never so high the camera loses the player.
  for (let c = 6; c < COLS - 6; c += randInt(rng, 5, 10)) {
    if (!chance(rng, 0.65)) continue
    const row = randInt(rng, 5, GROUND_ROW - 2)
    const width = randInt(rng, 3, 6)
    for (let i = 0; i < width && c + i < COLS; i++) {
      grid[row][c + i] = SOLID.Platform
    }
    // A chip on top is the reason to make the jump at all.
    if (chance(rng, 0.8)) {
      const p = tileCentre(c + Math.floor(width / 2), row - 1)
      spawns.push({ kind: SPAWN.Chip, x: p.x, y: p.y, range: 0 })
    }
  }

  // --- hazards and enemies, scaled by the director --------------------
  placeOnGround(rng, spawns, solidGround, 0.1 * spawnRateScale, SPAWN.Spike)
  placeOnGround(rng, spawns, solidGround, 0.05 * spawnRateScale, SPAWN.Fire)
  placeOnGround(rng, spawns, solidGround, 0.06 * spawnRateScale, SPAWN.Walker)

  for (let c = 12; c < COLS - 6; c += randInt(rng, 8, 16)) {
    if (!chance(rng, 0.45 * spawnRateScale)) continue
    const p = tileCentre(c, randInt(rng, 3, 7))
    spawns.push({ kind: SPAWN.Flyer, x: p.x, y: p.y, range: randInt(rng, 3, 5) * TILE_SIZE })
  }

  // --- ground-level chips ----------------------------------------------
  for (let c = 4; c < COLS - 4; c += randInt(rng, 4, 9)) {
    if (!solidGround[c] || !chance(rng, 0.5)) continue
    const p = tileCentre(c, GROUND_ROW - 1)
    spawns.push({ kind: SPAWN.Chip, x: p.x, y: p.y, range: 0 })
  }

  const start = tileCentre(2, GROUND_ROW - 1)

  return {
    grid,
    spawns,
    startX: start.x,
    startY: start.y,
    widthPx: COLS * TILE_SIZE,
    heightPx: ROWS * TILE_SIZE,
    seed,
  }
}

function placeOnGround(
  rng: Rng,
  spawns: Spawn[],
  solidGround: readonly boolean[],
  density: number,
  kind: SpawnKind,
): void {
  // Column 10 onward: the opening stretch stays clear so a shift never drops
  // the player straight onto a hazard before they have their bearings.
  for (let c = 10; c < COLS - 4; c++) {
    if (!solidGround[c] || !chance(rng, density)) continue
    // Keep hazards off pit edges, where they are unfair rather than hard.
    if (!solidGround[c - 1] || !solidGround[c + 1]) continue
    const p = tileCentre(c, GROUND_ROW - 1)
    const range = kind === SPAWN.Walker ? randInt(rng, 2, 4) * TILE_SIZE : 0
    spawns.push({ kind, x: p.x, y: p.y, range })
  }
}

/** Convenience for callers that just want a fresh seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}
