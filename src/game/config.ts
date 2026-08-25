import Phaser from 'phaser'
import { DEV } from '../dev.ts'
import { GRAVITY_Y, VIEW_H, VIEW_W } from './constants.ts'
import { BootScene } from './scenes/BootScene.ts'
import { PlatformerScene } from './scenes/PlatformerScene.ts'
import { RunnerScene } from './scenes/RunnerScene.ts'
import { ShiftDirectorScene } from './scenes/ShiftDirectorScene.ts'
import { SpaceShooterScene } from './scenes/SpaceShooterScene.ts'

/** Largest integer zoom that fits VIEW_W x VIEW_H inside the given box. */
export function computeZoom(availW: number, availH: number): number {
  return Math.max(1, Math.floor(Math.min(availW / VIEW_W, availH / VIEW_H)))
}

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#08060f',
    // Some headless/automated browser environments never report the page as
    // visible (document.hidden stays true), which suspends requestAnimationFrame
    // entirely. Forcing a setTimeout-based loop keeps the game (and automated
    // verification) running regardless. The explicit blur-pause handler in
    // GameCanvas is the real pause mechanism for users backgrounding the tab.
    fps: { forceSetTimeOut: true },
    render: { pixelArt: true, antialias: false, roundPixels: true },
    scale: {
      mode: Phaser.Scale.NONE,
      // NO_CENTER, not CENTER_BOTH: .game-host already centres the canvas with
      // CSS grid, and Phaser's autoCenter adds its own margins on top of that,
      // which pushes the canvas visibly off-centre on tall viewports. One
      // owner for centring, and it is the stylesheet.
      autoCenter: Phaser.Scale.NO_CENTER,
      zoom: computeZoom(parent.clientWidth, parent.clientHeight),
    },
    // A per-scene default only. Every ModeScene sets world gravity itself in
    // create() -- the shooter sets it to 0 -- because each scene owns its own
    // arcade World and must not inherit the previous mode's pull.
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: GRAVITY_Y }, debug: DEV.physics },
    },
    input: {
      keyboard: {
        capture: [
          Phaser.Input.Keyboard.KeyCodes.SPACE,
          Phaser.Input.Keyboard.KeyCodes.SHIFT,
          Phaser.Input.Keyboard.KeyCodes.UP,
          Phaser.Input.Keyboard.KeyCodes.DOWN,
          Phaser.Input.Keyboard.KeyCodes.LEFT,
          Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ],
      },
    },
    // Only the first entry auto-starts (SceneManager sets autoStart on i===0).
    // Everything else stays inert until BootScene launches or starts it.
    scene: [
      BootScene,
      ShiftDirectorScene,
      PlatformerScene,
      SpaceShooterScene,
      RunnerScene,
    ],
  }
}
