import type Phaser from 'phaser'
import { ATLAS_KEY } from './atlas.ts'

export const ANIM = {
  Walk: 'player-walk',
  Fire: 'fire-flicker',
  Walker: 'walker-shuffle',
  Flyer: 'flyer-flap',
  Ship: 'ship-thrust',
  Gunship: 'gunship-pulse',
} as const

/**
 * Explicit frame arrays (not generateFrameNames) so this doesn't depend on
 * a Phaser 4 frame-name-pattern API we haven't verified against source.
 * Guarded against StrictMode's mount -> unmount -> mount re-running create().
 */
export function createAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists(ANIM.Walk)) return

  const loop = (key: string, frames: readonly string[], frameRate: number) => {
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: ATLAS_KEY, frame })),
      frameRate,
      repeat: -1,
    })
  }

  loop(ANIM.Walk, ['player-walk-0', 'player-walk-1', 'player-walk-2', 'player-walk-3'], 10)
  loop(ANIM.Fire, ['fire-0', 'fire-1'], 6)
  loop(ANIM.Walker, ['walker-0', 'walker-1'], 4)
  loop(ANIM.Flyer, ['flyer-0', 'flyer-1'], 8)
  loop(ANIM.Ship, ['ship-0', 'ship-1'], 12)
  loop(ANIM.Gunship, ['gunship-0', 'gunship-1'], 6)
}
