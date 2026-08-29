import type Phaser from 'phaser'
import { ALL_MEME_SPRITE_ROLES } from '../../memeTheme/index.ts'
import type { MemeSpriteRole, MemeTheme } from '../../memeTheme/index.ts'
import { ATLAS_KEY } from './atlas.ts'
import { drawSprite, makeCanvas } from './pixels.ts'

const CELL = 16
const COLS = 4

export interface SpriteRef {
  readonly key: string
  readonly frame: string
}

export function memeAtlasKey(theme: MemeTheme): string {
  return `meme-atlas:${theme.date}:${theme.id}:${theme.variantId ?? 'global'}`
}

export function buildMemeAtlas(scene: Phaser.Scene, theme: MemeTheme): string | null {
  if (!theme.spritePack) return null
  const key = memeAtlasKey(theme)
  if (scene.textures.exists(key)) return key

  const rows = Math.ceil(ALL_MEME_SPRITE_ROLES.length / COLS)
  const canvas = makeCanvas(COLS * CELL, rows * CELL)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false

  ALL_MEME_SPRITE_ROLES.forEach((role, i) => {
    drawSprite(ctx, theme.spritePack![role], (i % COLS) * CELL, Math.floor(i / COLS) * CELL)
  })

  const tex = scene.textures.addCanvas(key, canvas)
  if (!tex) return null
  ALL_MEME_SPRITE_ROLES.forEach((role, i) => {
    tex.add(role, 0, (i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL)
  })
  return key
}

export function spriteForRole(
  scene: Phaser.Scene,
  theme: MemeTheme,
  role: MemeSpriteRole,
  fallbackFrame: string,
): SpriteRef {
  const key = buildMemeAtlas(scene, theme)
  if (!key) return { key: ATLAS_KEY, frame: fallbackFrame }
  return { key, frame: role }
}
