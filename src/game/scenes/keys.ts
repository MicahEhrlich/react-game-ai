import type { GameMode } from '../../state/types.ts'
import { MODE } from '../../state/types.ts'

export const SCENE = {
  Boot: 'Boot',
  ShiftDirector: 'ShiftDirector',
  Platformer: 'Platformer',
  Shooter: 'Shooter',
  Runner: 'Runner',
} as const
export type SceneKey = (typeof SCENE)[keyof typeof SCENE]

/** The one place a GameMode is turned into a scene to start. */
export const SCENE_FOR_MODE: Readonly<Record<GameMode, SceneKey>> = {
  [MODE.Platformer]: SCENE.Platformer,
  [MODE.Shooter]: SCENE.Shooter,
  [MODE.Runner]: SCENE.Runner,
}
