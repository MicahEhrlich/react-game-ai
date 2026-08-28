import { useEffect, useRef, useState } from 'react'
import { touch } from '../game/touch.ts'
import { useGameValue } from '../state/store.ts'
import { MODE, PHASE } from '../state/types.ts'
import { viewportToGamePoint } from './touchGeometry.ts'

/**
 * On-screen controls for mobile. Every handler writes into the plain `touch`
 * module rather than React state -- a thumb on the d-pad changes at frame
 * rate, and routing that through React would re-render the tree 60x a second
 * for input the renderer never needs to see.
 *
 * The component itself re-renders only when the controls appear.
 */
export function TouchControls() {
  const mode = useGameValue((s) => s.mode)
  const phase = useGameValue((s) => s.phase)
  const gesture = useRef<{ x: number; y: number; time: number; jumped: boolean } | null>(null)
  // Touch-primary devices get the controls immediately; everything else gets
  // them on phone/tablet-sized layouts.
  const [visible, setVisible] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024),
  )

  useEffect(() => {
    if (visible) return
    const onFirstTouch = () => setVisible(true)
    const onResize = () => {
      if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024) {
        setVisible(true)
      }
    }
    window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('touchstart', onFirstTouch)
      window.removeEventListener('resize', onResize)
    }
  }, [visible])

  // A held button must not survive the controls unmounting at a shift.
  useEffect(() => () => touch.releaseAll(), [])
  useEffect(() => {
    gesture.current = null
    touch.releaseAll()
  }, [mode, phase])

  if (!visible) return null

  if (phase !== PHASE.Playing) return null

  const pointFor = (e: React.PointerEvent<HTMLElement>) => {
    const rect =
      document.querySelector<HTMLCanvasElement>('.game-host canvas')?.getBoundingClientRect() ??
      e.currentTarget.getBoundingClientRect()
    return viewportToGamePoint(e.clientX, e.clientY, rect)
  }

  const onSurfaceDown = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointFor(e)
    touch.setAim(p.x, p.y)
    gesture.current = { x: p.x, y: p.y, time: performance.now(), jumped: false }
    if (mode === MODE.Runner) touch.pressJump()
  }

  const onSurfaceMove = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    if (e.buttons === 0) return
    const p = pointFor(e)
    touch.setAim(p.x, p.y)
    const g = gesture.current
    if (mode === MODE.Platformer && g && !g.jumped && g.y - p.y >= 22) {
      touch.pressJump()
      g.jumped = true
    }
  }

  const release = {
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const g = gesture.current
      if (mode === MODE.Platformer && g && !g.jumped) {
        const p = pointFor(e)
        const dist = Math.hypot(p.x - g.x, p.y - g.y)
        if (performance.now() - g.time <= 180 && dist <= 12) touch.pressJump()
      }
      gesture.current = null
      touch.releaseHeld()
    },
    onPointerCancel: () => {
      gesture.current = null
      touch.releaseAll()
    },
    onPointerLeave: () => {
      gesture.current = null
      touch.releaseAll()
    },
  }

  return (
    <div
      className="touch touch--direct"
      aria-hidden="true"
      onPointerDown={onSurfaceDown}
      onPointerMove={onSurfaceMove}
      {...release}
    >
      {mode === MODE.Runner && (
        <button
          type="button"
          className="touch-btn touch-btn--slide touch-btn--runner-slide"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            touch.setSlide(true)
          }}
          {...release}
        >
          SLIDE
        </button>
      )}
    </div>
  )
}
