import { useEffect, useState } from 'react'
import { DEV } from '../dev.ts'
import { commands } from '../state/commands.ts'
import { scores } from '../scores/index.ts'
import { AudioControls } from './AudioControls.tsx'
import { HighScoreTable } from './HighScoreTable.tsx'

export function MenuOverlay() {
  const [adultAck, setAdultAck] = useState(false)
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof scores.top>>>([])

  useEffect(() => {
    let live = true
    void scores.top(5).then((next) => {
      if (live) setEntries(next)
    })
    return () => {
      live = false
    }
  }, [])

  if (DEV.adultMemeMode && !adultAck) {
    return (
      <div className="overlay">
        <div className="panel panel--warning">
          <h1 className="panel-title" data-text="ADULT MEME MODE">
            ADULT MEME MODE
          </h1>
          <p className="panel-sub panel-sub--warning">
            This optional mode contains adult, dark, political, violent, and potentially
            disturbing meme humor. It does not represent the creator&apos;s political,
            religious, or personal beliefs.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setAdultAck(true)}>
            I UNDERSTAND
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay">
      <div className="panel">
        <h1 className="panel-title" data-text="GLITCH SHIFT">
          GLITCH SHIFT
        </h1>
        <p className="panel-sub">
          You are inside a corrupted arcade machine. It cannot hold one game for long.
        </p>

        <ul className="panel-rules">
          <li>The mode changes every 18–30 seconds. Score and core carry across.</li>
          <li>A director watches how you play and tunes what comes next.</li>
          <li>Clean play raises the multiplier. Any damage resets it.</li>
        </ul>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => commands.send({ type: 'START_RUN' })}
        >
          INSERT COIN
        </button>

        <AudioControls />

        <p className="panel-keys">
          MOVE ←→ / WASD · JUMP ↑ / SPACE · FIRE SPACE / SHIFT · SLIDE ↓ · PAUSE ESC
        </p>

        <HighScoreTable entries={entries} />
      </div>
    </div>
  )
}
