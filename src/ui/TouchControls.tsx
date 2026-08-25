import { useEffect, useState } from 'react'
import { touch } from '../game/touch.ts'

/**
 * On-screen controls for mobile. Every handler writes into the plain `touch`
 * module rather than React state -- a thumb on the d-pad changes at frame
 * rate, and routing that through React would re-render the tree 60x a second
 * for input the renderer never needs to see.
 *
 * The component itself re-renders only when the controls appear.
 */
export function TouchControls() {
  // Touch-primary devices get the controls immediately; everything else gets
  // them the moment a real touch happens -- a laptop with a touchscreen
  // shouldn't have a d-pad over the game unless its owner uses one. Read in
  // the initialiser rather than an effect, so there is no second render.
  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )

  useEffect(() => {
    if (visible) return
    const onFirstTouch = () => setVisible(true)
    window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', onFirstTouch)
  }, [visible])

  // A held button must not survive the controls unmounting at a shift.
  useEffect(() => () => touch.releaseAll(), [])

  if (!visible) return null

  const hold = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      fn()
    },
  })

  const release = {
    onPointerUp: () => touch.releaseAll(),
    onPointerCancel: () => touch.releaseAll(),
    onPointerLeave: () => touch.releaseAll(),
  }

  return (
    <div className="touch" aria-hidden="true">
      <div className="touch-pad">
        <button
          type="button"
          className="touch-btn"
          {...hold(() => touch.setDir(-1, 0))}
          {...release}
        >
          ◀
        </button>
        <button
          type="button"
          className="touch-btn"
          {...hold(() => touch.setDir(0, -1))}
          {...release}
        >
          ▲
        </button>
        <button
          type="button"
          className="touch-btn"
          {...hold(() => touch.setDir(0, 1))}
          {...release}
        >
          ▼
        </button>
        <button
          type="button"
          className="touch-btn"
          {...hold(() => touch.setDir(1, 0))}
          {...release}
        >
          ▶
        </button>
      </div>

      <div className="touch-actions">
        <button
          type="button"
          className="touch-btn touch-btn--jump"
          {...hold(() => touch.pressJump())}
          {...release}
        >
          JUMP
        </button>
        <button
          type="button"
          className="touch-btn touch-btn--fire"
          {...hold(() => touch.setAction(true))}
          {...release}
        >
          FIRE
        </button>
        <button
          type="button"
          className="touch-btn touch-btn--slide"
          {...hold(() => touch.setSlide(true))}
          {...release}
        >
          SLIDE
        </button>
      </div>
    </div>
  )
}
