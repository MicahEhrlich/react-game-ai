/**
 * Touch input lives in a plain module, NOT React state, for the same reason
 * gameStore holds only discrete values: a thumb on a d-pad changes at frame
 * rate, and routing that through React would re-render the tree 60x a second.
 * TouchControls.tsx writes here; InputReader reads here.
 */
export interface TouchState {
  dirX: -1 | 0 | 1
  dirY: -1 | 0 | 1
  aimX: number | null
  aimY: number | null
  directTouch: boolean
  action: boolean
  jumpHeld: boolean
  /** Set true for exactly one read by the consumer, then cleared. */
  jumpEdge: boolean
  slide: boolean
  /** Set true for exactly one read by the consumer, then cleared. */
  slideEdge: boolean
}

export const JOYSTICK_DEAD_ZONE_PX = 12
export const JOYSTICK_MOTION_DEAD_ZONE_PX = 2
export const JOYSTICK_RADIUS_PX = 62

const state: TouchState = {
  dirX: 0,
  dirY: 0,
  aimX: null,
  aimY: null,
  directTouch: false,
  action: false,
  jumpHeld: false,
  jumpEdge: false,
  slide: false,
  slideEdge: false,
}

/** True once any touch/pointer input has been seen -- gates the on-screen UI. */
let touchSeen = false

export const touch = {
  get state(): Readonly<TouchState> {
    return state
  },
  get seen(): boolean {
    return touchSeen
  },

  setDir(x: -1 | 0 | 1, y: -1 | 0 | 1): void {
    state.dirX = x
    state.dirY = y
    touchSeen = true
  },
  setDirFromVector(dx: number, dy: number): void {
    const mag = Math.hypot(dx, dy)
    if (mag < JOYSTICK_DEAD_ZONE_PX) {
      this.setDir(0, 0)
      return
    }
    const nx = dx / mag
    const ny = dy / mag
    const x = Math.abs(nx) >= 0.38 ? (nx < 0 ? -1 : 1) : 0
    const y = Math.abs(ny) >= 0.38 ? (ny < 0 ? -1 : 1) : 0
    this.setDir(x, y)
  },
  setDirFromMotion(dx: number, dy: number): void {
    if (Math.hypot(dx, dy) < JOYSTICK_MOTION_DEAD_ZONE_PX) return
    const x = Math.abs(dx) >= JOYSTICK_MOTION_DEAD_ZONE_PX ? (dx < 0 ? -1 : 1) : 0
    const y = Math.abs(dy) >= JOYSTICK_MOTION_DEAD_ZONE_PX ? (dy < 0 ? -1 : 1) : 0
    this.setDir(x, y)
  },
  setAction(down: boolean): void {
    state.action = down
    touchSeen = true
  },
  setAim(x: number, y: number): void {
    state.aimX = x
    state.aimY = y
    state.directTouch = true
    touchSeen = true
  },
  clearAim(): void {
    state.aimX = null
    state.aimY = null
    state.directTouch = false
  },
  releaseHeld(): void {
    state.dirX = 0
    state.dirY = 0
    state.aimX = null
    state.aimY = null
    state.directTouch = false
    state.action = false
    state.jumpHeld = false
    state.slide = false
  },
  setSlide(down: boolean): void {
    if (down && !state.slide) state.slideEdge = true
    state.slide = down
    touchSeen = true
  },
  /** A discrete jump/tap; consumed by the next InputReader.read(). */
  pressJump(): void {
    state.jumpHeld = true
    state.jumpEdge = true
    touchSeen = true
  },
  consumeJumpEdge(): boolean {
    const v = state.jumpEdge
    state.jumpEdge = false
    return v
  },
  consumeSlideEdge(): boolean {
    const v = state.slideEdge
    state.slideEdge = false
    return v
  },

  /** Called when a scene shuts down so a held button can't leak across a shift. */
  releaseAll(): void {
    state.dirX = 0
    state.dirY = 0
    state.aimX = null
    state.aimY = null
    state.directTouch = false
    state.action = false
    state.jumpHeld = false
    state.jumpEdge = false
    state.slide = false
    state.slideEdge = false
  },
}
