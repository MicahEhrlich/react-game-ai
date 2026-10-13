import type Phaser from 'phaser'
import { DEPTH } from '../constants.ts'
import headUrl from '../../assets/bibi/head.png'
import monoHeadUrl from '../../assets/bibi/head-mono.png'

export const BIBI_HEAD_KEY = 'bibi:reference-head'
export const BIBI_MONO_HEAD_KEY = 'bibi:reference-head-mono'
export const BIBI_REFERENCE_HEAD_W = 20
export const BIBI_REFERENCE_HEAD_H = 25
export const BIBI_AIRCRAFT_HEAD_TOP = BIBI_REFERENCE_HEAD_H + 17
export { monoHeadUrl }

export function preloadBibiHead(scene: Phaser.Scene): void {
  for (const [key, url] of [[BIBI_HEAD_KEY, headUrl], [BIBI_MONO_HEAD_KEY, monoHeadUrl]]) {
    if (!scene.textures.exists(key)) scene.load.image(key, url)
  }
}

export function createBibiHead(scene: Phaser.Scene): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(BIBI_HEAD_KEY)) return null
  return scene.add.image(0, 0, BIBI_HEAD_KEY).setDepth(DEPTH.Player + 1)
}

/** Offsets are relative to the costume's origin, including its mirrored brick offset. */
export function bibiHeadPose(mode: string, frame: string, flipX: boolean, flipY: boolean) {
  if (frame === 'player-slide') return { dx: flipX ? -4 : 4, dy: 0, width: 10, height: 6, originY: 0 }
  return {
    dx: mode === 'shooter' ? (flipX ? -8 : 8) : 0,
    dy: (mode === 'shooter' ? -17 : -5) * (flipY ? -1 : 1),
    width: BIBI_REFERENCE_HEAD_W, height: BIBI_REFERENCE_HEAD_H, originY: flipY ? 0 : 1,
  }
}
