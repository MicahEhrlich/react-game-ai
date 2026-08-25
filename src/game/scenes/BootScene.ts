import Phaser from 'phaser'
import { createAnims } from '../art/anims.ts'
import { buildAtlas } from '../art/atlas.ts'
import { SCENE } from './keys.ts'

/**
 * There is no preload(): all art is built from ASCII pixel data and all core
 * audio is synthesised, so nothing is fetched before the first frame. Boot
 * builds the texture atlas, registers animations, hands control to the
 * always-on ShiftDirectorScene, and stops itself.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.Boot)
  }

  create(): void {
    buildAtlas(this)
    createAnims(this)

    this.scene.launch(SCENE.ShiftDirector)
    this.scene.stop()
  }
}
