import { music } from '../src/game/music.ts'
import { sfx } from '../src/game/audio.ts'
import { audioSettings } from '../src/game/audioSettings.ts'
import { adultMemeThemeById, offlineMemeThemeForDate } from '../src/memeTheme/index.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

console.log('validate-music')

;(globalThis as unknown as { window: unknown }).window = {
  setInterval: () => 1,
  clearInterval: () => {},
}

try {
  const theme = offlineMemeThemeForDate('2026-08-28')
  music.play(theme.musicPlan)
  music.pause()
  music.resume()
  audioSettings.setMusicVolume(0)
  music.resume()
  music.stop()
  music.stop()
  const kirk = adultMemeThemeById('kirk-mode', '2026-09-01')
  if (!kirk) fail('kirk mode theme was not available for sampled music validation')
  else {
    music.playForTheme(kirk, true)
    audioSettings.setMusicVolume(0.5)
    music.pause()
    music.resume()
    music.stop()
  }
  audioSettings.setSfxVolume(0)
  sfx.jump()
  sfx.pickup()
  sfx.glitch()
} catch (err) {
  fail(err instanceof Error ? err.message : 'music lifecycle threw')
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  music lifecycle tolerates locked audio')
