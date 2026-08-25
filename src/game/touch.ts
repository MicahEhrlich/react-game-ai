/**
 * Touch input lives in a plain module, NOT React state, for the same reason
 * gameStore holds only discrete values: a thumb on a d-pad changes at frame
 * rate, and routing that through React would re-render the tree 60x a second.
 * TouchControls.tsx writes here; InputReader reads here.
 */
export interface TouchState {
  dirX: -1 | 0 | 1
  dirY: -1 | 0 | 1
  action: boolean
  /** Set true for exactly one read by the consumer, then cleared. */
  jumpEdge: boolean
  slide: boolean
}

const state: TouchState = {
  dirX: 0,
  dirY: 0,
  action: false,
  jumpEdge: false,
  slide: false,
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
  setAction(down: boolean): void {
    state.action = down
    touchSeen = true
  },
  setSlide(down: boolean): void {
    state.slide = down
    touchSeen = true
  },
  /** A discrete jump/tap; consumed by the next InputReader.read(). */
  pressJump(): void {
    state.jumpEdge = true
    touchSeen = true
  },
  consumeJumpEdge(): boolean {
    const v = state.jumpEdge
    state.jumpEdge = false
    return v
  },

  /** Called when a scene shuts down so a held button can't leak across a shift. */
  releaseAll(): void {
    state.dirX = 0
    state.dirY = 0
    state.action = false
    state.jumpEdge = false
    state.slide = false
  },
}
