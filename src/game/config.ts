import Phaser from 'phaser'
import { DEV } from '../dev.ts'
import { ALL_MODES, MODE } from '../state/types.ts'
import type { GameMode } from '../state/types.ts'
import { GRAVITY_Y, VIEW_H, VIEW_W } from './constants.ts'
import { BootScene } from './scenes/BootScene.ts'
import { PlatformerScene } from './scenes/PlatformerScene.ts'
import { RunnerScene } from './scenes/RunnerScene.ts'
import { ShiftDirectorScene } from './scenes/ShiftDirectorScene.ts'
import { SpaceShooterScene } from './scenes/SpaceShooterScene.ts'

/**
 * Every mode scene, keyed by mode.
 *
 * A Record<GameMode, ...> rather than a bare array, so a mode added to MODE is
 * a COMPILE ERROR here. The array version failed silently in the worst
 * possible way: a mode missing from it made ShiftDirectorScene's
 * `scene.launch()` a no-op, so the run continued with a black screen and
 * nothing logged anywhere.
 *
 * Lives here rather than in scenes/keys.ts because every mode scene imports
 * keys.ts -- putting scene classes there would be an import cycle.
 */
const MODE_SCENES: Readonly<Record<GameMode, new () => Phaser.Scene>> = {
  [MODE.Platformer]: PlatformerScene,
  [MODE.Shooter]: SpaceShooterScene,
  [MODE.Runner]: RunnerScene,
}

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
    // Mode scenes come from MODE_SCENES so the list can never fall behind MODE.
    scene: [BootScene, ShiftDirectorScene, ...ALL_MODES.map((m) => MODE_SCENES[m])],
  }
}
