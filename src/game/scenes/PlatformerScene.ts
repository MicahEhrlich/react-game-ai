import Phaser from 'phaser'
import { DEV } from '../../dev.ts'
import { metrics } from '../../state/metrics.ts'
import type { GameMode } from '../../state/types.ts'
import { MODE } from '../../state/types.ts'
import { ANIM } from '../art/anims.ts'
import { ATLAS_KEY } from '../art/atlas.ts'
import { sfx } from '../audio.ts'
import {
  CAM_DEADZONE_H,
  CAM_DEADZONE_W,
  CAM_LERP,
  DEPTH,
  DMG_ENEMY,
  DMG_HAZARD,
  DMG_PIT,
  SCORE_PICKUP,
  TILE_SIZE,
  VIEW_H,
  VIEW_W,
} from '../constants.ts'
import { Flyer, Walker } from '../entities/Enemy.ts'
import { Avatar } from '../entities/Avatar.ts'
import type { InputState } from '../input.ts'
import { generatePlatformer, randomSeed, SOLID, SPAWN } from '../levels/generatePlatformer.ts'
import type { PlatformerLevel } from '../levels/generatePlatformer.ts'
import { pickEasyPlatformerSeed } from '../levels/easyPlatformerLevels.ts'
import { LEVEL_DIFFICULTY } from '../levels/difficulty.ts'
import { MEME_SPRITE_ROLE } from '../../memeTheme/index.ts'
import { platformerTouchDirX } from '../touchSteering.ts'
import { ModeScene } from './ModeScene.ts'
import { SCENE } from './keys.ts'

/** Mode A: precision movement, jumping, hazard avoidance. */
export class PlatformerScene extends ModeScene {
  readonly modeId: GameMode = MODE.Platformer

  // Every field here is reset at the top of setupMode() -- scene.start()
  // reuses this instance and would otherwise carry the last stage's state.
  private level!: PlatformerLevel
  private player!: Avatar
  private solids!: Phaser.Physics.Arcade.StaticGroup
  private enemies: (Walker | Flyer)[] = []
  private lastSafeX = 0
  private lastSafeY = 0
  private playerCostume?: Phaser.GameObjects.Graphics

  constructor() {
    super(SCENE.Platformer)
  }

  protected setupMode(): void {
    this.enemies = []
    this.lastSafeX = 0
    this.lastSafeY = 0
    this.playerCostume = undefined

    this.cameras.main.setBackgroundColor('#0d0a20')

    // ?difficulty=easy draws from a curated, pre-checked pool instead of a
    // fully random seed (scripts/gen-levels.ts curates it, levelCheck.ts
    // checked it) -- everything else about generation, including the
    // pit-width safety margin below, applies regardless.
    const seed =
      import.meta.env.DEV && DEV.difficulty === LEVEL_DIFFICULTY.Easy
        ? pickEasyPlatformerSeed()
        : randomSeed()

    this.level = generatePlatformer(
      seed,
      this.mods.spawnRateScale,
      this.physics.world.gravity.y,
      this.mods.playerSpeedScale,
    )
    this.buildTerrain()
    this.buildStarfield()

    this.player = new Avatar(
      this,
      this.level.startX,
      this.level.startY,
      this.mods.playerSpeedScale,
    )
    this.player.setDepth(DEPTH.Player)
    this.avatar = this.player
    if (this.memeTheme.id === 'maga-rally') {
      this.playerCostume = this.add.graphics().setDepth(DEPTH.Player + 1)
    }
    this.lastSafeX = this.level.startX
    this.lastSafeY = this.level.startY

    this.physics.add.collider(this.player, this.solids)
    this.buildSpawns()

    // Headroom above so a high jump doesn't clip the world edge, and open
    // space below so a pit fall has room to read as a fall.
    this.physics.world.setBounds(0, -64, this.level.widthPx, this.level.heightPx + 256)

    const cam = this.cameras.main
    cam.setBounds(0, 0, this.level.widthPx, VIEW_H)
    cam.startFollow(this.player, true, CAM_LERP, CAM_LERP)
    cam.setDeadzone(CAM_DEADZONE_W, CAM_DEADZONE_H)
  }

  protected updateMode(input: InputState, _time: number, delta: number): void {
    this.player.drive(this.mobileSteeringInput(input), delta)
    this.updatePlayerCostume()
    for (const e of this.enemies) e.patrol()

    const body = this.player.body as Phaser.Physics.Arcade.Body

    // Remember the last spot the player stood on solid ground, so a pit
    // respawn puts them somewhere survivable rather than back at the start.
    if (body.blocked.down && this.player.y < this.level.heightPx) {
      this.lastSafeX = this.player.x
      this.lastSafeY = this.player.y - TILE_SIZE
    }

    if (this.player.y > this.level.heightPx + 48) this.onPitFall()

    // Reaching the far end regenerates the level ahead. At 105px/s top speed
    // the 140-tile level takes ~21s to cross, close to a stage's own 18-30s
    // length -- so unlike when stages ran 45-75s, this is a path a fast
    // player will actually reach within a single stage, not just a rare
    // safety net.
    if (this.player.x > this.level.widthPx - TILE_SIZE * 3) this.regenerate()
  }

  // --- construction ------------------------------------------------------

  private buildTerrain(): void {
    this.solids = this.physics.add.staticGroup()
    const frameFor = { [SOLID.Ground]: 'tile-brick', [SOLID.Platform]: 'tile-girder' }

    for (const [row, cells] of this.level.grid.entries()) {
      for (const [col, kind] of cells.entries()) {
        if (kind === SOLID.None) continue
        const tile = this.solids.create(
          col * TILE_SIZE + TILE_SIZE / 2,
          row * TILE_SIZE + TILE_SIZE / 2,
          ATLAS_KEY,
          frameFor[kind],
        ) as Phaser.Physics.Arcade.Sprite
        tile.setDepth(DEPTH.Terrain)
      }
    }
  }

  /** Cheap parallax so the corrupted-arcade backdrop isn't flat black. */
  private buildStarfield(): void {
    if (this.memeTheme.id === 'tabloid-island') {
      this.buildIslandBackdrop()
      return
    }
    const g = this.add.graphics().setScrollFactor(0.25).setDepth(DEPTH.Background)
    for (let i = 0; i < 90; i++) {
      const shade = [0x3ef0ff, 0xff3ea5, 0x3b3560][i % 3]
      g.fillStyle(shade, 0.35)
      g.fillRect(Math.random() * VIEW_W * 2, Math.random() * VIEW_H, 1, 1)
    }
  }

  private buildIslandBackdrop(): void {
    const g = this.add.graphics().setScrollFactor(0.18).setDepth(DEPTH.Background)
    g.fillStyle(0x071a2a, 0.95)
    g.fillRect(0, 0, this.level.widthPx, VIEW_H)
    g.fillStyle(0x1080a0, 0.35)
    g.fillRect(0, VIEW_H - 42, this.level.widthPx, 42)
    for (let x = 36; x < this.level.widthPx; x += 152) {
      g.fillStyle(0xffe14d, 0.48)
      g.fillEllipse(x, VIEW_H - 35, 96, 20)
      g.fillStyle(0xffc9a0, 0.68)
      g.fillRect(x - 22, VIEW_H - 68, 4, 34)
      g.fillStyle(0x1c7a4a, 0.82)
      g.fillEllipse(x - 30, VIEW_H - 72, 28, 10)
      g.fillEllipse(x - 18, VIEW_H - 79, 28, 9)
      g.fillEllipse(x - 8, VIEW_H - 70, 28, 10)
      g.fillStyle(0xff9a2e, 0.9)
      g.fillCircle(x - 18, VIEW_H - 73, 2)
      g.fillCircle(x - 13, VIEW_H - 72, 2)
      g.fillStyle(0xf2eeff, 0.62)
      g.fillRect(x + 14, VIEW_H - 84, 50, 30)
      g.fillStyle(0xffe14d, 0.55)
      g.fillTriangle(x + 11, VIEW_H - 84, x + 39, VIEW_H - 104, x + 67, VIEW_H - 84)
      g.fillStyle(0x3b3560, 0.58)
      g.fillRect(x + 22, VIEW_H - 78, 8, 10)
      g.fillRect(x + 44, VIEW_H - 78, 8, 10)
    }
  }

  private updatePlayerCostume(): void {
    const g = this.playerCostume
    if (!g) return
    g.clear()
    const x = this.player.x
    const y = this.player.y
    g.lineStyle(1, 0x08060f, 1)
    g.fillStyle(0x1c2f8c, 0.98)
    g.fillRect(x - 7, y - 6, 14, 9)
    g.strokeRect(x - 7, y - 6, 14, 9)
    g.fillStyle(0xf2eeff, 1)
    g.fillTriangle(x - 5, y - 6, x - 1, y - 6, x - 2, y - 2)
    g.fillTriangle(x + 5, y - 6, x + 1, y - 6, x + 2, y - 2)
    g.fillStyle(0xff4d4d, 1)
    g.fillRect(x - 1, y - 5, 2, 5)
    g.fillTriangle(x - 2, y, x + 2, y, x, y + 3)
    g.fillStyle(0xffc9a0, 1)
    g.fillRect(x - 5, y - 16, 10, 8)
    g.strokeRect(x - 5, y - 16, 10, 8)
    g.fillStyle(0x08060f, 1)
    g.fillRect(x - 3, y - 12, 2, 1)
    g.fillRect(x + 2, y - 12, 2, 1)
    g.fillRect(x + 1, y - 9, 5, 1)
    g.fillStyle(0xff9a2e, 1)
    g.fillRect(x - 6, y - 19, 11, 3)
    g.fillRect(x - 7, y - 17, 3, 7)
    g.fillRect(x + 3, y - 18, 5, 2)
    g.fillRect(x + 7, y - 20, 2, 4)
    g.fillStyle(0xffe14d, 0.85)
    g.fillRect(x - 5, y - 19, 8, 1)
  }

  private buildSpawns(): void {
    const hazards = this.physics.add.staticGroup()
    const chips = this.physics.add.staticGroup()

    for (const s of this.level.spawns) {
      switch (s.kind) {
        case SPAWN.Spike:
        case SPAWN.Fire: {
          const frame = s.kind === SPAWN.Spike ? 'spike' : 'fire-0'
          const sprite = this.memeSprite(MEME_SPRITE_ROLE.PlatformerHazard, frame)
          const h = hazards.create(s.x, s.y, ATLAS_KEY, frame) as Phaser.Physics.Arcade.Sprite
          h.setTexture(sprite.key, sprite.frame)
          h.setDepth(DEPTH.Terrain)
          h.setTint(this.memeAccent(1, 0xff3ea5))
          this.addMemeDecal(s.x, s.y - 13, this.memeTheme.modeFlavor[this.modeId].hazard, 1)
          if (s.kind === SPAWN.Fire && sprite.key === ATLAS_KEY) h.anims.play(ANIM.Fire, true)
          break
        }
        case SPAWN.Chip: {
          const c = chips.create(s.x, s.y, ATLAS_KEY, 'chip') as Phaser.Physics.Arcade.Sprite
          c.setDepth(DEPTH.Pickup)
          c.setTint(this.memeAccent(0, 0x3ef0ff))
          break
        }
        case SPAWN.Walker: {
          const w = new Walker(
            this,
            s.x,
            s.y,
            s.range,
            this.mods.projectileSpeedScale,
            this.memeSprite(MEME_SPRITE_ROLE.PlatformerEnemy, 'walker-0'),
          )
          w.setDepth(DEPTH.Enemy)
          w.setTint(this.memeAccent(0, 0x3ef0ff))
          this.addMemeDecal(s.x, s.y - 16, this.memeTheme.modeFlavor[this.modeId].enemy, 0)
          this.physics.add.collider(w, this.solids)
          this.enemies.push(w)
          break
        }
        case SPAWN.Flyer: {
          const f = new Flyer(
            this,
            s.x,
            s.y,
            s.range,
            this.mods.projectileSpeedScale,
            this.memeSprite(MEME_SPRITE_ROLE.PlatformerEnemy, 'flyer-0'),
          )
          f.setDepth(DEPTH.Enemy)
          f.setTint(this.memeAccent(2, 0xff3ea5))
          this.addMemeDecal(s.x, s.y - 15, this.memeTheme.modeFlavor[this.modeId].enemy, 2)
          this.enemies.push(f)
          break
        }
      }
    }

    this.physics.add.overlap(this.player, hazards, () => {
      this.takeDamage(DMG_HAZARD)
    })

    // A plain array, not a Group -- see the note in Enemy.ts.
    this.physics.add.overlap(this.player, this.enemies, () => {
      this.takeDamage(DMG_ENEMY)
    })

    this.physics.add.overlap(this.player, chips, (_p, chip) => {
      this.collectChip(chip as Phaser.Physics.Arcade.Sprite)
    })
  }

  // --- events -------------------------------------------------------------

  private mobileSteeringInput(input: InputState): InputState {
    if (!input.directTouch || input.aimX === null) return input
    return {
      ...input,
      dirX: platformerTouchDirX(input.aimX, this.cameras.main.scrollX, this.player.x),
    }
  }

  private addMemeDecal(x: number, y: number, label: string, paletteIndex: number): void {
    if (this.memeTheme.id === 'maga-rally') label = paletteIndex === 0 ? 'MAGA' : ''
    if (!label) return
    this.add
      .text(x, y, label, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '7px',
        color: this.memeTheme.palette[paletteIndex % this.memeTheme.palette.length] ?? '#3ef0ff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.Background)
      .setAlpha(0.82)
  }

  private collectChip(chip: Phaser.Physics.Arcade.Sprite): void {
    if (!chip.active) return
    chip.destroy()
    sfx.pickup()
    metrics.pickedUp()
    this.award(SCORE_PICKUP)
    this.rewardStreak()
  }

  private onPitFall(): void {
    // Damage is dealt unconditionally, but the reposition must happen even
    // when i-frames swallow the hit -- otherwise the player keeps falling.
    this.takeDamage(DMG_PIT)
    this.player.setPosition(this.lastSafeX, this.lastSafeY)
    this.player.setVelocity(0, 0)
  }

  private regenerate(): void {
    this.scene.restart()
  }
}
