import { CHAOS_LABEL } from '../director/modifiers.ts'
import { PLAN_SOURCE } from '../director/types.ts'
import { MODE_LABEL } from '../state/types.ts'
import { useGameState } from '../state/store.ts'

/**
 * Reads only the discrete store. The shift countdown is quantised to whole
 * seconds inside ShiftDirectorScene before it is patched, so this re-renders
 * about once a second during play rather than once per frame.
 */
export function Hud() {
  const {
    score,
    health,
    maxHealth,
    multiplier,
    mode,
    shiftIndex,
    secondsToShift,
    shiftWarning,
    activeChaos,
    directorSource,
    memeTheme,
  } = useGameState()

  const healthPct = Math.max(0, Math.round((health / maxHealth) * 100))

  return (
    <div className="hud">
      <div className="hud-row">
        <span className="hud-label">SCORE</span>
        <span className="hud-value">{score.toString().padStart(7, '0')}</span>
      </div>

      <div className="hud-row">
        <span className="hud-label">CORE</span>
        <span className="hud-bar" aria-label={`Health ${healthPct} percent`}>
          <span
            className={healthPct <= 30 ? 'hud-bar-fill hud-bar-fill--low' : 'hud-bar-fill'}
            style={{ width: `${healthPct}%` }}
          />
        </span>
      </div>

      <div className="hud-row">
        <span className="hud-label">MODE</span>
        <span className="hud-value hud-value--mode">{MODE_LABEL[mode]}</span>
      </div>

      <div className="hud-row">
        <span className="hud-label">MULT</span>
        <span className={multiplier > 1 ? 'hud-value hud-value--hot' : 'hud-value'}>
          x{multiplier}
        </span>
      </div>

      <div className="hud-row">
        <span className="hud-label">
          SHIFT {shiftIndex}
          {/* Marks a stage a live director chose. It is the fastest way to
              tell "the AI is off" from "the AI answered too late", which are
              otherwise identical from the outside. */}
          {directorSource === PLAN_SOURCE.Llm && (
            <span className="hud-ai" title="stage written by the live director">
              {' '}
              ⌁
            </span>
          )}
        </span>
        <span className={shiftWarning ? 'hud-value hud-value--warn' : 'hud-value'}>
          {secondsToShift}s
        </span>
      </div>

      {/* Persists for the whole stage. Without it an inverted-controls stage
          is indistinguishable from a bug -- the transition banner announces
          it once, this is what answers the question 30 seconds later. */}
      {activeChaos && <div className="hud-chaos">⚠ {CHAOS_LABEL[activeChaos]}</div>}
      <div className="hud-meme" style={{ borderColor: memeTheme.palette[0] }}>
        MEME: {memeTheme.label}
      </div>
    </div>
  )
}
