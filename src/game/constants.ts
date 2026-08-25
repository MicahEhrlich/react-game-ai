// Units: pixels, pixels/second, pixels/second². World scale is 16px/tile.

export const TILE_SIZE = 16
export const VIEW_W = 320
export const VIEW_H = 192

// --- Run-wide ---
/** A single health pool that carries across every mode shift. */
export const START_HEALTH = 100
export const MAX_MULTIPLIER = 8

// --- Platformer physics (ported from react-game, tuned for 16px tiles) ---
export const GRAVITY_Y = 900
export const JUMP_VELOCITY = -300 // apex = 300² / (2·900) = 50px ≈ 3.1 tiles
export const JUMP_CUT_VELOCITY = -120 // vy clamped to this on early release
export const MAX_FALL_SPEED = 400
export const RUN_SPEED_MAX = 105 // ≈ 6.5 tiles/s
export const ACCEL_GROUND = 1200 // 0 -> max in ~0.09s: snappy, still not instant
export const ACCEL_AIR = 700
export const DRAG_GROUND = 1600
export const DRAG_AIR = 300 // low air drag = floaty, committed jumps
export const COYOTE_MS = 100
export const JUMP_BUFFER_MS = 120

// --- Shooter ---
export const SHIP_SPEED = 130
export const SHOT_SPEED = 260
export const SHOT_COOLDOWN_MS = 190
export const ENEMY_SHOT_SPEED = 120
export const SHOOTER_SPAWN_MS = 1100

// --- Runner ---
export const RUNNER_SCROLL_SPEED = 150
/** The stage ramps from SCROLL_SPEED to this over its full duration. */
export const RUNNER_MAX_SCROLL_SPEED = 290
export const RUNNER_SPAWN_MS = 900
export const RUNNER_SLIDE_MS = 420
export const RUNNER_JUMP_VELOCITY = -330

// --- Feel ---
export const INVULN_MS = 1000
export const INVULN_BLINK_MS = 80
export const RESPAWN_DELAY_MS = 700

// --- Bodies ---
export const PLAYER_BODY_W = 10
export const PLAYER_BODY_H = 14
export const PLAYER_BODY_OFF_X = 3
export const PLAYER_BODY_OFF_Y = 1

// --- Damage ---
export const DMG_HAZARD = 20
export const DMG_ENEMY = 15
export const DMG_PROJECTILE = 10
export const DMG_PIT = 25
export const DMG_OBSTACLE = 20

// --- Scoring (pre-multiplier base values) ---
export const SCORE_PICKUP = 100
export const SCORE_KILL = 150
export const SCORE_DODGE = 25
export const SCORE_SURVIVE_SHIFT = 1000

// --- Shift engine ---
/** How far ahead of the shift the next stage is planned and the HUD warns. */
export const SHIFT_WARNING_MS = 3000
/** How long the glitch overlay covers the scene swap. */
export const GLITCH_DURATION_MS = 900

// --- Camera ---
export const CAM_LERP = 0.12
export const CAM_DEADZONE_W = 80
export const CAM_DEADZONE_H = VIEW_H

/**
 * Display-list ordering. Named rather than inline so a new object type can be
 * slotted in without hunting for the magic numbers it has to sit between.
 */
export const DEPTH = {
  Background: -20,
  Terrain: 0,
  Pickup: 5,
  Enemy: 10,
  Projectile: 15,
  Player: 20,
  Fog: 60,
  Corruption: 80,
} as const

// --- Platformer enemies ---
export const WALKER_SPEED = 40
export const FLYER_SPEED = 70
