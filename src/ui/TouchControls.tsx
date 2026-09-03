import { useEffect, useRef, useState } from 'react'
import { JOYSTICK_RADIUS_PX, touch } from '../game/touch.ts'
import { useGameValue } from '../state/store.ts'
import { MODE, PHASE } from '../state/types.ts'
import { viewportToGamePoint } from './touchGeometry.ts'

const RUNNER_SLIDE_DRAG_PX = 24
const PLATFORMER_JUMP_DRAG_PX = 18

function clampStick(dx: number, dy: number): { x: number; y: number } {
  const mag = Math.hypot(dx, dy)
  if (mag <= JOYSTICK_RADIUS_PX) return { x: dx, y: dy }
  const scale = JOYSTICK_RADIUS_PX / mag
  return { x: dx * scale, y: dy * scale }
}

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
  const gesture = useRef<{ x: number; y: number; jumped: boolean; slid: boolean } | null>(null)
  const stick = useRef<{
    originX: number
    originY: number
    lastX: number
    lastY: number
    pointerId: number
    jumped: boolean
  } | null>(null)
  const [stickThumb, setStickThumb] = useState({ x: 0, y: 0 })
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
    stick.current = null
    setStickThumb({ x: 0, y: 0 })
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
    gesture.current = { x: p.x, y: p.y, jumped: false, slid: false }
    if (mode === MODE.Runner) touch.pressJump()
  }

  const onSurfaceMove = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    if (e.buttons === 0) return
    const p = pointFor(e)
    touch.setAim(p.x, p.y)
    const g = gesture.current
    if (mode === MODE.Runner && g && !g.slid && p.y - g.y >= RUNNER_SLIDE_DRAG_PX) {
      touch.setSlide(true)
      g.slid = true
    }
  }

  const release = {
    onPointerUp: () => {
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

  const joystickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    stick.current = {
      originX: e.clientX,
      originY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      pointerId: e.pointerId,
      jumped: false,
    }
    setStickThumb({ x: 0, y: 0 })
    touch.setDir(0, 0)
    if (mode === MODE.Shooter) touch.setAction(true)
  }

  const joystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stick.current
    if (!s || s.pointerId !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    const dx = e.clientX - s.originX
    const dy = e.clientY - s.originY
    const moveX = e.clientX - s.lastX
    const moveY = e.clientY - s.lastY
    s.lastX = e.clientX
    s.lastY = e.clientY
    const thumb = clampStick(dx, dy)
    setStickThumb(thumb)
    touch.setDirFromMotion(moveX, moveY)
    if (
      mode === MODE.Platformer &&
      !s.jumped &&
      (moveY <= -PLATFORMER_JUMP_DRAG_PX || touch.state.dirY === -1)
    ) {
      s.jumped = true
      touch.pressJump()
    }
    if (mode === MODE.Shooter) touch.setAction(true)
  }

  const joystickRelease = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stick.current
    if (s && s.pointerId !== e.pointerId) return
    e.preventDefault()
    e.stopPropagation()
    stick.current = null
    setStickThumb({ x: 0, y: 0 })
    touch.releaseHeld()
  }

  if (mode === MODE.Platformer || mode === MODE.Shooter) {
    return (
      <div className="touch touch--joystick-only" aria-hidden="true">
        <div
          className="touch-joystick"
          onPointerDown={joystickDown}
          onPointerMove={joystickMove}
          onPointerUp={joystickRelease}
          onPointerCancel={joystickRelease}
          onPointerLeave={joystickRelease}
        >
          <div className="touch-joystick-ring" />
          <div
            className="touch-joystick-thumb"
            style={{ transform: `translate(${stickThumb.x}px, ${stickThumb.y}px)` }}
          />
        </div>
      </div>
    )
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
