import { useEffect, useState } from 'react'
import { scores } from '../scores/index.ts'
import type { ScoreEntry } from '../scores/index.ts'
import { commands } from '../state/commands.ts'
import { useGameState } from '../state/store.ts'
import { MODE_LABEL } from '../state/types.ts'
import { HighScoreTable } from './HighScoreTable.tsx'

export function GameOverOverlay() {
  const { lastRunScore, shiftIndex, mode, runEpitaph } = useGameState()
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qualifies, setQualifies] = useState(false)
  const [entries, setEntries] = useState<ScoreEntry[]>([])

  useEffect(() => {
    let live = true
    void Promise.all([scores.qualifies(lastRunScore, 10), scores.top(5)]).then(([nextQualifies, nextEntries]) => {
      if (!live) return
      setQualifies(nextQualifies)
      setEntries(nextEntries)
    })
    return () => {
      live = false
    }
  }, [lastRunScore])

  const submit = () => {
    const trimmed = name.trim().slice(0, 8).toUpperCase()
    if (!trimmed || saving) return
    setSaving(true)
    void scores
      .submit({
        name: trimmed,
        score: lastRunScore,
        shifts: shiftIndex,
        at: Date.now(),
      })
      .then(() => scores.top(5))
      .then(setEntries)
      .finally(() => {
        setSubmitted(true)
        setSaving(false)
      })
  }

  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="panel-title" data-text="SIGNAL LOST">
          SIGNAL LOST
        </h2>

        <p className="panel-score">{lastRunScore.toLocaleString()}</p>
        <p className="panel-sub">
          {shiftIndex} {shiftIndex === 1 ? 'shift' : 'shifts'} survived · fell in{' '}
          {MODE_LABEL[mode]}
        </p>

        {/* The director's parting shot, when there is a live one. It lands a
            second or two after this panel opens, so it fades in rather than
            popping -- and its absence is the normal, unremarkable case.
            Rendered as a text node: never dangerouslySetInnerHTML. */}
        {runEpitaph && <p className="panel-epitaph">{runEpitaph}</p>}

        {qualifies && !submitted && (
          <div className="submit-row">
            <label className="submit-label" htmlFor="initials">
              HIGH SCORE — ENTER INITIALS
            </label>
            <input
              id="initials"
              className="submit-input"
              value={name}
              maxLength={8}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                // Stop arrows/space reaching the game while typing. Phaser's
                // keyboard capture is already disabled outside PHASE.Playing;
                // this covers the browser-level scroll instead.
                e.stopPropagation()
                if (e.key === 'Enter') submit()
              }}
            />
            <button type="button" className="btn" onClick={submit} disabled={saving}>
              {saving ? 'SAVING' : 'SAVE'}
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => commands.send({ type: 'START_RUN' })}
        >
          RUN IT BACK
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => commands.send({ type: 'QUIT_TO_MENU' })}
        >
          MENU
        </button>

        <HighScoreTable entries={entries} />
      </div>
    </div>
  )
}
