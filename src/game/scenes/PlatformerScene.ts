import Phaser from 'phaser'
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

  constructor() {
    super(SCENE.Platformer)
  }

  protected setupMode(): void {
    this.enemies = []
    this.lastSafeX = 0
    this.lastSafeY = 0

    this.cameras.main.setBackgroundColor('#0d0a20')

    this.level = generatePlatformer(randomSeed(), this.mods.spawnRateScale)
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
    this.player.drive(input, delta)
    for (const e of this.enemies) e.patrol()

    const body = this.player.body as Phaser.Physics.Arcade.Body

    // Remember the last spot the player stood on solid ground, so a pit
    // respawn puts them somewhere survivable rather than back at the start.
    if (body.blocked.down && this.player.y < this.level.heightPx) {
      this.lastSafeX = this.player.x
      this.lastSafeY = this.player.y - TILE_SIZE
    }

    if (this.player.y > this.level.heightPx + 48) this.onPitFall()

    // Reaching the far end regenerates the level ahead. A stage is 60-90s and
    // the level is 140 tiles, so this is a safety net, not the usual path.
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
    const g = this.add.graphics().setScrollFactor(0.25).setDepth(DEPTH.Background)
    for (let i = 0; i < 90; i++) {
      const shade = [0x3ef0ff, 0xff3ea5, 0x3b3560][i % 3]
      g.fillStyle(shade, 0.35)
      g.fillRect(Math.random() * VIEW_W * 2, Math.random() * VIEW_H, 1, 1)
    }
  }

  private buildSpawns(): void {
    const hazards = this.physics.add.staticGroup()
    const chips = this.physics.add.staticGroup()

    for (const s of this.level.spawns) {
      switch (s.kind) {
        case SPAWN.Spike:
        case SPAWN.Fire: {
          const frame = s.kind === SPAWN.Spike ? 'spike' : 'fire-0'
          const h = hazards.create(s.x, s.y, ATLAS_KEY, frame) as Phaser.Physics.Arcade.Sprite
          h.setDepth(DEPTH.Terrain)
          if (s.kind === SPAWN.Fire) h.anims.play(ANIM.Fire, true)
          break
        }
        case SPAWN.Chip: {
          const c = chips.create(s.x, s.y, ATLAS_KEY, 'chip') as Phaser.Physics.Arcade.Sprite
          c.setDepth(DEPTH.Pickup)
          break
        }
        case SPAWN.Walker: {
          const w = new Walker(this, s.x, s.y, s.range, this.mods.projectileSpeedScale)
          w.setDepth(DEPTH.Enemy)
          this.physics.add.collider(w, this.solids)
          this.enemies.push(w)
          break
        }
        case SPAWN.Flyer: {
          const f = new Flyer(this, s.x, s.y, s.range, this.mods.projectileSpeedScale)
          f.setDepth(DEPTH.Enemy)
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
