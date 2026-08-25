import { commands } from '../state/commands.ts'

export function PauseOverlay() {
  return (
    <div className="overlay">
      <div className="panel">
        <h2 className="panel-title" data-text="PAUSED">
          PAUSED
        </h2>
        <p className="panel-sub">The shift countdown is frozen.</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => commands.send({ type: 'RESUME' })}
        >
          RESUME
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => commands.send({ type: 'QUIT_TO_MENU' })}
        >
          QUIT TO MENU
        </button>
      </div>
    </div>
  )
}
