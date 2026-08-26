import { CHAOS_LABEL } from '../director/modifiers.ts'
import { MODE_LABEL } from '../state/types.ts'
import { useGameState } from '../state/store.ts'

/**
 * The visible half of the mode shift.
 *
 * Deliberately CSS rather than a WebGL post-processing pipeline: this is the
 * most load-bearing visual in the game and it renders identically regardless
 * of which renderer Phaser picked, or whether the canvas is mid-teardown
 * while scenes swap underneath it. The in-canvas corruption pass
 * (art/corruption.ts) draws the other half.
 */
export function GlitchOverlay() {
  const { nextMode, score, health, maxHealth, lastDirectorNotes, activeChaos } = useGameState()
  const label = nextMode ? MODE_LABEL[nextMode] : 'RECONFIGURING'

  return (
    <div className="glitch" role="status" aria-live="polite">
      <div className="glitch-scanlines" aria-hidden="true" />

      <div className="glitch-body">
        <p className="glitch-kicker">MODE SHIFT</p>
        <h2 className="glitch-title" data-text={label}>
          {label}
        </h2>

        {/* Promoted out of the notes list: a modifier that changes how the
            controls behave is the single most important thing on this screen,
            and as one bullet among four it was reliably missed. */}
        {activeChaos && (
          <p className="glitch-chaos">
            <span className="glitch-chaos-mark">⚠</span> {CHAOS_LABEL[activeChaos]}
          </p>
        )}

        {/* Notes are de-duplicated and capped in director/llmPlan.ts, but this
            list can render model-authored text, so the index is folded into
            the key and the length is capped here too. Neither should ever
            matter; both are cheap. */}
        <ul className="glitch-notes">
          {lastDirectorNotes.length > 0 ? (
            lastDirectorNotes
              .slice(0, 4)
              .map((note, i) => <li key={`${i}-${note}`}>{note}</li>)
          ) : (
            <li>DIRECTOR ONLINE</li>
          )}
        </ul>

        <p className="glitch-carry">
          SCORE {score.toString().padStart(7, '0')} · CORE{' '}
          {Math.max(0, Math.round((health / maxHealth) * 100))}%
        </p>
      </div>
    </div>
  )
}
