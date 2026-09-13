import Phaser from 'phaser'
import { createAnims } from '../art/anims.ts'
import { buildAtlas } from '../art/atlas.ts'
import { preloadRoshHashanahArt } from '../art/roshHashanahArt.ts'
import { assertModeScenesRegistered, SCENE } from './keys.ts'

/**
 * Preload the seasonal icons, retaining ASCII art as a loading-failure fallback.
 * Boot builds the texture atlas, registers animations, hands control to the
 * always-on ShiftDirectorScene, and stops itself.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.Boot)
  }

  preload(): void {
    preloadRoshHashanahArt(this)
  }

  create(): void {
    // Before anything can launch a mode: fail loudly here rather than with a
    // black screen twenty seconds into someone's run.
    assertModeScenesRegistered(this)

    buildAtlas(this)
    createAnims(this)

    this.scene.launch(SCENE.ShiftDirector)
    this.scene.stop()
  }
}
