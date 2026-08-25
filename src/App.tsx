import { useGameValue } from './state/store.ts'
import { PHASE } from './state/types.ts'
import { GameCanvas } from './ui/GameCanvas.tsx'
import { GameOverOverlay } from './ui/GameOverOverlay.tsx'
import { GlitchOverlay } from './ui/GlitchOverlay.tsx'
import { Hud } from './ui/Hud.tsx'
import { MenuOverlay } from './ui/MenuOverlay.tsx'
import { PauseOverlay } from './ui/PauseOverlay.tsx'
import { TouchControls } from './ui/TouchControls.tsx'
import './ui/ui.css'

/**
 * Selects only `phase`, so a score or health change re-renders the HUD and
 * nothing else.
 */
function App() {
  const phase = useGameValue((s) => s.phase)
  const playing = phase === PHASE.Playing || phase === PHASE.Shifting

  return (
    <div className="app">
      <div className="stage">
        {playing && <Hud />}
        <GameCanvas />
        {phase === PHASE.Shifting && <GlitchOverlay />}
        {phase === PHASE.Menu && <MenuOverlay />}
        {phase === PHASE.Paused && <PauseOverlay />}
        {phase === PHASE.GameOver && <GameOverOverlay />}
        {playing && <TouchControls />}
      </div>
    </div>
  )
}

export default App
