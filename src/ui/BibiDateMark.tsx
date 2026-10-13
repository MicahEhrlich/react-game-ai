import monoHeadUrl from '../assets/bibi/head-mono.png'
import { BIBI_DATE_MARK, BIBI_DATE_WIDTH, BIBI_DATE_HEIGHT, BIBI_DATE_LABEL } from '../memeTheme/bibiSprites.ts'

const paths = ['k', 'w'].map((color) => BIBI_DATE_MARK.flatMap((row, y) => [...row].flatMap((pixel, x) =>
  pixel === color && x < 32 ? [`M${x} ${y}h1v1h-1Z`] : [])).join(''))

/** The same pixel mark used in Phaser, with a readable text alternative. */
export function BibiDateMark() {
  return (
    <svg role="img" aria-label={BIBI_DATE_LABEL} viewBox={`0 0 ${BIBI_DATE_WIDTH} ${BIBI_DATE_HEIGHT}`}
      style={{ width: '3em', height: '1.25em', verticalAlign: 'middle' }} shapeRendering="crispEdges">
      <path d={paths[0]} fill="#000000" />
      <path d={paths[1]} fill="#ffffff" />
      <image href={monoHeadUrl} x="32" y="0" width="16" height="20" preserveAspectRatio="xMidYMid meet" style={{ imageRendering: 'pixelated' }} />
    </svg>
  )
}
