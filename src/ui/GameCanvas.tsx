import Phaser from 'phaser'
import { useEffect, useRef } from 'react'
import { unlockAudio } from '../game/audio.ts'
import { computeZoom, createGameConfig } from '../game/config.ts'
import { touch } from '../game/touch.ts'
import { commands } from '../state/commands.ts'
import { gameStore } from '../state/store.ts'
import { PHASE } from '../state/types.ts'

/**
 * Mounts a Phaser.Game into a host div and tears it down on unmount.
 *
 * React 19 StrictMode double-invokes effects in dev (mount -> unmount ->
 * mount). Phaser's boot sequence is async, and destroying a Game mid-boot
 * throws, so the first (StrictMode-discarded) instance defers its own
 * destruction until Phaser reports READY.
 */
export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let game: Phaser.Game | null = new Phaser.Game(createGameConfig(host))
    let disposed = false

    // Dev-only debug hook (never in a production build) so live scene state
    // can be inspected from the console.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __game: Phaser.Game }).__game = game
    }

    const destroy = () => {
      game?.destroy(true, false)
      game = null
    }

    game.events.once(Phaser.Core.Events.READY, () => {
      if (disposed) destroy()
    })

    const ro = new ResizeObserver(() => {
      if (game?.isBooted) {
        game.scale.setZoom(computeZoom(host.clientWidth, host.clientHeight))
      }
    })
    ro.observe(host)

    // Auto-pause when the tab/window loses focus.
    const onBlur = () => commands.send({ type: 'PAUSE' })
    game.events.on(Phaser.Core.Events.BLUR, onBlur)

    // Escape lives at the window level rather than in a scene, so it works
    // whichever mode is running and during a shift.
    const onKeyDown = (e: KeyboardEvent) => {
      unlockAudio()
      if (e.key !== 'Escape') return
      const phase = gameStore.get().phase
      if (phase === PHASE.Playing) commands.send({ type: 'PAUSE' })
      else if (phase === PHASE.Paused) commands.send({ type: 'RESUME' })
    }
    window.addEventListener('keydown', onKeyDown)

    // Browser autoplay policy: an AudioContext can't produce sound until a
    // user gesture, and a pointer gesture must count as well as a key.
    const onPointerDown = () => unlockAudio()
    window.addEventListener('pointerdown', onPointerDown)

    // Keyboard capture must be off outside play, or arrow/space presses in a
    // focused text field also drive the game. Subscribed directly to the
    // store, not via a React hook, so this component never re-renders.
    const syncKeyboardEnabled = () => {
      if (game?.isBooted && game.input.keyboard) {
        game.input.keyboard.enabled = gameStore.get().phase === PHASE.Playing
      }
    }
    const unsubscribeStore = gameStore.subscribe(syncKeyboardEnabled)

    return () => {
      disposed = true
      ro.disconnect()
      unsubscribeStore()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
      game?.events.off(Phaser.Core.Events.BLUR, onBlur)
      touch.releaseAll()
      if (game?.isBooted) destroy()
    }
  }, [])

  return <div ref={hostRef} className="game-host" />
}
