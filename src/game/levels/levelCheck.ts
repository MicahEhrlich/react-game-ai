import { TILE_SIZE } from '../constants.ts'
import { maxJumpDistancePx } from '../platformerPacing.ts'
import { GROUND_ROW, SOLID, SPAWN } from './generatePlatformer.ts'
import type { PlatformerLevel } from './generatePlatformer.ts'

/**
 * A real playability check for generated platformer terrain, run against the
 * SAME jump physics the player actually has (see platformerPacing.ts) --
 * not the "apex ~50px" comments in generatePlatformer.ts, which were never
 * asserted against anything. Before this file, generatePlatformer relied
 * entirely on construction constraints: a pit is capped at 2-3 tiles, a
 * hazard is never placed on a pit edge, and so on, all correct by
 * inspection but none of it checked against the real jump arc, and none of
 * it checked at all once gravityScale enters the picture.
 *
 * Pure and DOM-free: no fetch, no Phaser, no import.meta. That's what lets
 * scripts/gen-levels.ts and scripts/validate-levels.ts import this directly
 * under tsconfig.node.json, which has no DOM lib.
 *
 * What "solvable" means here is narrower than it might look, on purpose:
 * spikes, fire, walkers and flyers are all wired with physics.add.overlap
 * in PlatformerScene.buildSpawns(), never a collider. None of them block
 * movement -- they cost health on contact and the player walks straight
 * through. A PIT is the only thing that can actually stop forward progress
 * (there is no floor to stand on), and even a pit fall is recoverable --
 * onPitFall() deals damage and teleports back to the last grounded spot
 * rather than ending the run. So the one genuine solvability question is
 * "can every pit be jumped", and hazards/patrols are a DAMAGE-BUDGET
 * concern, not a blocking one -- they feed difficultyScore, not `solvable`.
 *
 * What this does NOT prove: that floating platforms are reachable (they are
 * optional chip rewards, never required to cross the level -- the ground
 * path alone always reaches the far end).
 */

export interface LevelReport {
  /** False when some PIT is wider than the jump can clear at all, under the
   *  gravity/speed this report was run against -- see the module doc for why
   *  hazards and patrols don't gate this. */
  readonly solvable: boolean
  readonly issues: readonly string[]
  readonly pitCount: number
  readonly maxPitWidthPx: number
  /** Ground-level hazard/enemy-patrol columns, as a fraction of level width.
   *  Damage-budget signal only; does not affect `solvable`. */
  readonly hazardDensity: number
  /** Longest unbroken run of hazardous columns, in px. Same caveat. */
  readonly longestHazardRunPx: number
  /**
   * A monotonic "how rough is this to play" ranking signal -- lower is
   * gentler. NOT a physics guarantee; `solvable` and `issues` are the
   * guarantee. This is only for picking the gentlest among many solvable
   * levels.
   */
  readonly difficultyScore: number
}

/** Widths (in tiles) of every gap in the ground row. */
function pitWidthsTiles(level: PlatformerLevel): number[] {
  const row = level.grid[GROUND_ROW]
  const widths: number[] = []
  let run = 0
  for (const cell of row) {
    if (cell === SOLID.None) {
      run++
    } else if (run > 0) {
      widths.push(run)
      run = 0
    }
  }
  if (run > 0) widths.push(run)
  return widths
}

/**
 * Marks every column a ground hazard or a patrol range touches, for the
 * DIFFICULTY score only (see the module doc -- none of this blocks movement,
 * so none of it feeds `solvable`). Walkers and flyers mark their full patrol
 * span rather than a fixed point, which is the safe direction to be
 * approximate in: more marked columns means a higher difficultyScore, never
 * a spurious "unsolvable".
 */
function hazardColumns(level: PlatformerLevel): boolean[] {
  const cols = Math.ceil(level.widthPx / TILE_SIZE)
  const marks = new Array<boolean>(cols).fill(false)

  for (const s of level.spawns) {
    if (s.kind === SPAWN.Chip) continue
    const centreCol = Math.floor(s.x / TILE_SIZE)
    const rangeCols = Math.ceil(s.range / TILE_SIZE)
    for (let c = centreCol - rangeCols; c <= centreCol + rangeCols; c++) {
      if (c >= 0 && c < cols) marks[c] = true
    }
  }
  return marks
}

function longestRun(marks: readonly boolean[]): number {
  let longest = 0
  let run = 0
  for (const m of marks) {
    run = m ? run + 1 : 0
    if (run > longest) longest = run
  }
  return longest
}

/**
 * Checks one generated level against the jump it will actually be played
 * with. `gravityY` and `playerSpeedScale` should be the same values the
 * stage's modifiers will install -- a level that is fine at gravityScale 1
 * is not automatically fine at 1.6.
 */
export function checkPlatformerLevel(
  level: PlatformerLevel,
  gravityY: number,
  playerSpeedScale: number,
): LevelReport {
  const issues: string[] = []
  const maxJumpPx = maxJumpDistancePx(gravityY, playerSpeedScale)
  // A pit or hazard run exactly at the limit leaves no room for imperfect
  // timing, so anything within one tile of it is flagged rather than only
  // anything strictly over it.
  const safetyMarginPx = maxJumpPx - TILE_SIZE

  const pits = pitWidthsTiles(level)
  const maxPitWidthPx = pits.length > 0 ? Math.max(...pits) * TILE_SIZE : 0
  if (maxPitWidthPx > safetyMarginPx) {
    issues.push(
      `pit of ${maxPitWidthPx}px exceeds the safe jump distance (${Math.round(safetyMarginPx)}px)`,
    )
  }

  // Damage-budget signal only -- overlap-only hazards never block movement,
  // so a long patrol run makes a level ROUGHER, not unsolvable.
  const marks = hazardColumns(level)
  const longestHazardRunPx = longestRun(marks) * TILE_SIZE
  const hazardCols = marks.filter(Boolean).length
  const hazardDensity = hazardCols / marks.length

  const difficultyScore =
    hazardDensity * 100 + pits.length * 2 + (longestHazardRunPx / TILE_SIZE) * 3

  return {
    solvable: issues.length === 0,
    issues,
    pitCount: pits.length,
    maxPitWidthPx,
    hazardDensity,
    longestHazardRunPx,
    difficultyScore,
  }
}
