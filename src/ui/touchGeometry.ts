import { VIEW_H, VIEW_W } from '../game/constants.ts'

export interface ClientRectLike {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export function viewportToGamePoint(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
): { x: number; y: number } {
  const safeW = Math.max(1, rect.width)
  const safeH = Math.max(1, rect.height)
  const x = ((clientX - rect.left) / safeW) * VIEW_W
  const y = ((clientY - rect.top) / safeH) * VIEW_H
  return {
    x: Math.max(0, Math.min(VIEW_W, x)),
    y: Math.max(0, Math.min(VIEW_H, y)),
  }
}
