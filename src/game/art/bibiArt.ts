import { BIBI_MONO_HEAD_KEY, BIBI_AIRCRAFT_HEAD_TOP } from './bibiHead.ts'
import type Phaser from 'phaser'
import { DEPTH, VIEW_H, VIEW_W } from '../constants.ts'
import { COURT_TEXT, BIBI_CHARACTER, BIBI_CALLOUTS, BIBI_AIRCRAFT, AIRCRAFT_WIDTH, AIRCRAFT_HEIGHT, AIRCRAFT_ORIGIN_Y,
  BIBI_CHARACTER_WIDTH, BIBI_CHARACTER_ORIGIN_Y, BIBI_CHARACTER_PALETTE, BIBI_DATE_MARK, BIBI_DATE_WIDTH } from '../../memeTheme/bibiSprites.ts'

export const COURT_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold', resolution: 3,
  // Phaser's RTL path positions text using physical canvas width after scaling
  // the context by resolution, clipping it at resolutions greater than one.
  // Canvas still orders the Hebrew run correctly with a left-aligned origin.
  color: '#ffffff', stroke: '#08060f', strokeThickness: 1, rtl: false,
}

const CLOCK_TEXT = '06:29'

/** Bounds for the original 12×8 collision body, inset to contain the larger art. */
export const AIRCRAFT_BODY_BOUNDS = {
  x: AIRCRAFT_WIDTH / 2 - 6, y: BIBI_AIRCRAFT_HEAD_TOP - 4,
  width: VIEW_W - AIRCRAFT_WIDTH + 12, height: VIEW_H - BIBI_AIRCRAFT_HEAD_TOP - (AIRCRAFT_HEIGHT - AIRCRAFT_ORIGIN_Y) + 8,
}

export function themeText(scene: Phaser.Scene, x: number, y: number, text: string, size = 7): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, text === COURT_TEXT ? COURT_TEXT_STYLE : {
    fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color: '#f2eeff',
    stroke: '#08060f', strokeThickness: 2, rtl: /[\u0590-\u05ff]/.test(text),
  }).setOrigin(0.5).setDepth(DEPTH.Enemy + 1)
}

export function drawBibiAircraft(g: Phaser.GameObjects.Graphics, showHead = true): void {
  g.clear()
  BIBI_AIRCRAFT.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (!showHead && y < 23 && x >= 20 && x < 44) return
    const color = BIBI_CHARACTER_PALETTE[pixel]
    if (!color) return
    g.fillStyle(Number.parseInt(color.slice(1), 16), 1)
    g.fillRect(x - AIRCRAFT_WIDTH / 2, y - AIRCRAFT_ORIGIN_Y, 1, 1)
  }))
}

type LabelOwner = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & { active: boolean; visible: boolean }

/** Text follows its owner, but is never flipped with the sprite. */
export function attachThemeLabel(scene: Phaser.Scene, owner: LabelOwner, text: string, dy = -12): Phaser.GameObjects.Text {
  const label = themeText(scene, owner.x, owner.y + dy, text)
  const follow = () => { label.setPosition(owner.x, owner.y + dy).setVisible(owner.visible && owner.active) }
  const dispose = () => {
    scene.events.off('postupdate', follow)
    scene.events.off('shutdown', dispose)
    owner.off('destroy', dispose)
    label.destroy()
  }
  scene.events.on('postupdate', follow)
  scene.events.once('shutdown', dispose)
  owner.once('destroy', dispose)
  return label
}

/** Labels sit above the artwork without flipping with their owners. */
export function attachBibiObstacleLabel(scene: Phaser.Scene, owner: LabelOwner, kind: 'court' | 'alarm'): Phaser.GameObjects.Text {
  return attachThemeLabel(scene, owner, kind === 'court' ? COURT_TEXT : CLOCK_TEXT, kind === 'court' ? -14 : -12)
}

export function addBibiBackdrop(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.Background)
  g.fillStyle(0x1b2440, 0.55).fillRect(0, 0, VIEW_W, VIEW_H)
  g.lineStyle(1, 0x8f88b8, 0.2)
  for (let x = 18; x < VIEW_W; x += 72) g.strokeRect(x, 24, 54, 78)
  const mark = scene.add.graphics().setPosition(VIEW_W - BIBI_DATE_WIDTH - 8, 12)
    .setScrollFactor(0).setDepth(DEPTH.Background + 1)
  const referenceHead = scene.textures.exists(BIBI_MONO_HEAD_KEY)
  drawBibiDateMark(mark, !referenceHead)
  if (referenceHead) {
    scene.add.image(mark.x + 40, mark.y + 20, BIBI_MONO_HEAD_KEY).setOrigin(0.5, 1)
      .setDisplaySize(16, 20).setScrollFactor(0).setDepth(DEPTH.Background + 1)
  }
  // Quiet scenery, behind gameplay and away from the HUD.
  const callout = themeText(scene, VIEW_W / 2, 37, BIBI_CALLOUTS[0], 9)
    .setScrollFactor(0).setDepth(DEPTH.Background).setAlpha(0)
  let next = 0
  scene.time.addEvent({ delay: 5500, loop: true, callback: () => {
    callout.setText(BIBI_CALLOUTS[next++ % 2]).setAlpha(0.55)
    scene.tweens.add({ targets: callout, alpha: 0, delay: 1500, duration: 650 })
  } })
}

export function drawBibiDateMark(g: Phaser.GameObjects.Graphics, showHead = true): void {
  g.clear()
  BIBI_DATE_MARK.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === '.' || (!showHead && x >= 32)) return
    g.fillStyle(pixel === 'w' ? 0xffffff : 0x000000, 1).fillRect(x, y, 1, 1)
  }))
}

export function drawBibiCharacter(g: Phaser.GameObjects.Graphics, frame: string, time: number, showHead = true): void {
  g.clear()
  const slide = frame === 'player-slide'
  const walking = frame.startsWith('player-walk')
  const airborne = frame === 'player-jump' || frame === 'player-fall'
  const stride = walking ? Math.floor(time / 100) % 2 : 0
  for (let y = 0; y < BIBI_CHARACTER.length; y++) {
    if (!showHead && y < 19) continue
    for (let x = 0; x < BIBI_CHARACTER_WIDTH; x++) {
      const color = BIBI_CHARACTER_PALETTE[BIBI_CHARACTER[y][x]]
      if (!color) continue
      const legShift = y >= 28 ? (x < BIBI_CHARACTER_WIDTH / 2 ? -stride : stride) : 0
      const armShift = airborne && y >= 23 && y <= 24 && ['f', '4', '5'].includes(BIBI_CHARACTER[y][x])
        ? (x < BIBI_CHARACTER_WIDTH / 2 ? -1 : 1) : 0
      g.fillStyle(Number.parseInt(color.slice(1), 16), 1)
      g.fillRect(x - BIBI_CHARACTER_WIDTH / 2 + legShift + armShift,
        slide ? Math.floor(y / 4) : y - BIBI_CHARACTER_ORIGIN_Y, 1, 1)
    }
  }
}
