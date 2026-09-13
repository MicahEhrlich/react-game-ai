import type Phaser from 'phaser'
import { MEME_SPRITE_ROLE, ROSH_HASHANAH_THEME_ID } from '../../memeTheme/index.ts'
import type { MemeSpriteRole, MemeTheme } from '../../memeTheme/index.ts'
import appleUrl from '../../assets/rosh-hashanah/apple.png'
import honeyUrl from '../../assets/rosh-hashanah/honey.png'
import pomegranateUrl from '../../assets/rosh-hashanah/pomegranate.png'

const ART = {
  apple: { key: 'rosh-hashanah:apple', url: appleUrl },
  honey: { key: 'rosh-hashanah:honey', url: honeyUrl },
  pomegranate: { key: 'rosh-hashanah:pomegranate', url: pomegranateUrl },
} as const

const ROLE_ART: Partial<Record<MemeSpriteRole, keyof typeof ART>> = {
  [MEME_SPRITE_ROLE.Apple]: 'apple',
  [MEME_SPRITE_ROLE.Honey]: 'honey',
  [MEME_SPRITE_ROLE.PlatformerHazard]: 'pomegranate',
  [MEME_SPRITE_ROLE.RunnerObstacle]: 'pomegranate',
}

export function preloadRoshHashanahArt(scene: Phaser.Scene): void {
  for (const { key, url } of Object.values(ART)) {
    if (!scene.textures.exists(key)) scene.load.image(key, url)
  }
}

/** Keep the atlas's 16px frames and physics sizes; missing art uses pixel-data fallback. */
export function drawRoshHashanahArt(
  scene: Phaser.Scene,
  theme: MemeTheme,
  role: MemeSpriteRole,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): boolean {
  if (theme.id !== ROSH_HASHANAH_THEME_ID) return false
  const asset = ROLE_ART[role]
  if (!asset || !scene.textures.exists(ART[asset].key)) return false
  const source = scene.textures.get(ART[asset].key).getSourceImage() as HTMLImageElement
  ctx.drawImage(source, x, y, size, size)
  return true
}
