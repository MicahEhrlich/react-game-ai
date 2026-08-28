import { audioSettings, useAudioSettings } from '../game/audioSettings.ts'

function pct(v: number): number {
  return Math.round(v * 100)
}

export function AudioControls() {
  const { musicVolume, sfxVolume } = useAudioSettings()

  return (
    <div className="audio-controls" aria-label="Audio volume controls">
      <label className="audio-control">
        <span className="audio-control-label">MUSIC</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={pct(musicVolume)}
          onChange={(e) => audioSettings.setMusicVolume(Number(e.currentTarget.value) / 100)}
        />
        <span className="audio-control-value">{pct(musicVolume)}%</span>
      </label>
      <label className="audio-control">
        <span className="audio-control-label">SOUND</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={pct(sfxVolume)}
          onChange={(e) => audioSettings.setSfxVolume(Number(e.currentTarget.value) / 100)}
        />
        <span className="audio-control-value">{pct(sfxVolume)}%</span>
      </label>
    </div>
  )
}
