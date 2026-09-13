import type Phaser from 'phaser'
import { ALL_MEME_SPRITE_ROLES } from '../../memeTheme/index.ts'
import type { MemeSpriteRole, MemeTheme } from '../../memeTheme/index.ts'
import { ATLAS_KEY } from './atlas.ts'
import { drawSprite, makeCanvas } from './pixels.ts'
import { drawRoshHashanahArt } from './roshHashanahArt.ts'

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
  const roles = ALL_MEME_SPRITE_ROLES.filter((role) => theme.spritePack?.[role])

  const rows = Math.ceil(roles.length / COLS)
  const canvas = makeCanvas(COLS * CELL, rows * CELL)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false

  roles.forEach((role, i) => {
    const sprite = theme.spritePack?.[role]
    if (!sprite) return
    const x = (i % COLS) * CELL
    const y = Math.floor(i / COLS) * CELL
    if (!drawRoshHashanahArt(scene, theme, role, ctx, x, y, CELL)) {
      drawSprite(ctx, sprite, x, y)
    }
  })

  const tex = scene.textures.addCanvas(key, canvas)
  if (!tex) return null
  roles.forEach((role, i) => {
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
  if (!theme.spritePack?.[role]) return { key: ATLAS_KEY, frame: fallbackFrame }
  const key = buildMemeAtlas(scene, theme)
  if (!key) return { key: ATLAS_KEY, frame: fallbackFrame }
  return { key, frame: role }
}
