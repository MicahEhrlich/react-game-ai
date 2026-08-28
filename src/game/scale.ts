import { VIEW_H, VIEW_W } from './constants.ts'

/**
 * Zoom that fits VIEW_W x VIEW_H inside the host.
 *
 * Desktop keeps integer zoom for crisp pixel art. Phone/tablet layouts use
 * fractional zoom, because a 320px-wide game locked to 1x looks tiny on
 * modern high-density screens whose CSS viewport is still only ~390-430px.
 */
export function computeZoom(availW: number, availH: number): number {
  const fit = Math.min(availW / VIEW_W, availH / VIEW_H)
  if (!Number.isFinite(fit) || fit <= 0) return 1
  if (availW <= 1024 || availH <= 768) return Math.max(1, fit)
  return Math.max(1, Math.floor(fit))
}
