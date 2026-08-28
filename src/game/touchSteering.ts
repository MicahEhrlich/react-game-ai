export function relativeAxis(target: number, current: number, deadZone: number): -1 | 0 | 1 {
  const delta = target - current
  if (Math.abs(delta) <= deadZone) return 0
  return delta < 0 ? -1 : 1
}

export function platformerTouchDirX(
  aimX: number,
  cameraScrollX: number,
  playerX: number,
  deadZone = 10,
): -1 | 0 | 1 {
  return relativeAxis(cameraScrollX + aimX, playerX, deadZone)
}

export function shooterTouchDir(
  aimX: number,
  aimY: number,
  shipX: number,
  shipY: number,
  deadZone = 8,
): { dirX: -1 | 0 | 1; dirY: -1 | 0 | 1 } {
  return {
    dirX: relativeAxis(aimX, shipX, deadZone),
    dirY: relativeAxis(aimY, shipY, deadZone),
  }
}

export function brickTouchDirX(aimX: number, paddleX: number, deadZone = 8): -1 | 0 | 1 {
  return relativeAxis(aimX, paddleX, deadZone)
}
