import type Phaser from 'phaser'
import type { GameMode } from '../../state/types.ts'
import { ALL_MODES, MODE } from '../../state/types.ts'

export const SCENE = {
  Boot: 'Boot',
  ShiftDirector: 'ShiftDirector',
  Platformer: 'Platformer',
  Shooter: 'Shooter',
  Runner: 'Runner',
  Brick: 'Brick',
} as const
export type SceneKey = (typeof SCENE)[keyof typeof SCENE]

/** The one place a GameMode is turned into a scene to start. */
export const SCENE_FOR_MODE: Readonly<Record<GameMode, SceneKey>> = {
  [MODE.Platformer]: SCENE.Platformer,
  [MODE.Shooter]: SCENE.Shooter,
  [MODE.Runner]: SCENE.Runner,
  [MODE.Brick]: SCENE.Brick,
}

/**
 * Every mode routes to a scene that is actually registered AND actually
 * declares that mode.
 *
 * The Record above catches a MISSING entry at compile time; this catches a
 * WRONG one, which no type can. Both failures land the same way at runtime --
 * `scene.launch()` quietly does nothing, or launches the wrong game -- and
 * "black screen halfway through a run" points nowhere near SCENE_FOR_MODE.
 *
 * Deliberately NOT dev-gated, unlike atlas.ts's assertFrameSizes: it is a
 * handful of map lookups once at boot, and a thrown error naming the exact
 * mis-wiring is far better in production than a silent black screen.
 */
export function assertModeScenesRegistered(scene: Phaser.Scene): void {
  for (const mode of ALL_MODES) {
    const key = SCENE_FOR_MODE[mode]
    const target = scene.scene.get(key) as { modeId?: string } | null
    if (!target) {
      throw new Error(
        `Mode "${mode}" routes to scene "${key}", which is not registered in createGameConfig`,
      )
    }
    if (target.modeId !== mode) {
      throw new Error(
        `Scene "${key}" declares modeId "${String(target.modeId)}", but SCENE_FOR_MODE routes "${mode}" to it`,
      )
    }
  }
}
