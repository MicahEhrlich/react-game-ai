import {
  DEFAULT_AUDIO_SETTINGS,
  audioSettings,
  normaliseAudioSettings,
} from '../src/game/audioSettings.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

console.log('validate-audio-settings')

if (DEFAULT_AUDIO_SETTINGS.musicVolume !== 0.6) fail('music default changed')
if (DEFAULT_AUDIO_SETTINGS.sfxVolume !== 0.8) fail('sound default changed')

const bad = normaliseAudioSettings({ musicVolume: Number.NaN, sfxVolume: 'loud' })
if (bad.musicVolume !== 0.6 || bad.sfxVolume !== 0.8) fail('bad values did not fall back')

const clamped = normaliseAudioSettings({ musicVolume: 2, sfxVolume: -1 })
if (clamped.musicVolume !== 1 || clamped.sfxVolume !== 0) fail('values did not clamp')

let notifications = 0
const unsub = audioSettings.subscribe(() => notifications++)
const before = notifications
audioSettings.setMusicVolume(audioSettings.get().musicVolume)
if (notifications !== before) fail('unchanged value notified subscribers')
audioSettings.setMusicVolume(0.35)
audioSettings.setSfxVolume(0.45)
unsub()
if (audioSettings.get().musicVolume !== 0.35) fail('music update did not stick')
if (audioSettings.get().sfxVolume !== 0.45) fail('sound update did not stick')
if (notifications < 2) fail('changed values did not notify subscribers')

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  audio settings validate and notify correctly')
