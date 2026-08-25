import { commands } from '../state/commands.ts'
import { scores } from '../scores/index.ts'
import { HighScoreTable } from './HighScoreTable.tsx'

export function MenuOverlay() {
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
          <li>The mode changes every 60–90 seconds. Score and core carry across.</li>
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

        <p className="panel-keys">
          MOVE ←→ / WASD · JUMP ↑ / SPACE · FIRE SPACE / SHIFT · SLIDE ↓ · PAUSE ESC
        </p>

        <HighScoreTable entries={scores.top(5)} />
      </div>
    </div>
  )
}
