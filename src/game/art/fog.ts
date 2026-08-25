import type Phaser from 'phaser'
import { DEPTH } from '../constants.ts'
import { makeCanvas } from './pixels.ts'

export const FOG_TEXTURE_KEY = 'fog'

/**
 * The fogOfWar modifier, as a radial-gradient texture rather than a shader or
 * a geometry mask: it renders identically under WebGL and the Canvas
 * fallback, and costs one draw call.
 *
 * The texture is sized past the view's diagonal so that wherever the
 * spotlight is centred, its opaque outer region still covers every corner of
 * the 320x192 view.
 */
const SIZE = 768

function buildTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FOG_TEXTURE_KEY)) return

  const canvas = makeCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable while building fog')

  const c = SIZE / 2
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c)
  gradient.addColorStop(0, 'rgba(8, 6, 15, 0)')
  gradient.addColorStop(0.18, 'rgba(8, 6, 15, 0)')
  gradient.addColorStop(0.32, 'rgba(8, 6, 15, 0.72)')
  gradient.addColorStop(0.45, 'rgba(8, 6, 15, 1)')
  gradient.addColorStop(1, 'rgba(8, 6, 15, 1)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, SIZE, SIZE)

  scene.textures.addCanvas(FOG_TEXTURE_KEY, canvas)
}

/**
 * Adds the spotlight overlay. It is fixed to the camera (scrollFactor 0) and
 * repositioned each frame by ModeScene to the avatar's screen position.
 */
export function addFog(scene: Phaser.Scene): Phaser.GameObjects.Image {
  buildTexture(scene)
  return scene.add
    .image(0, 0, FOG_TEXTURE_KEY)
    .setScrollFactor(0)
    .setDepth(DEPTH.Fog)
}
