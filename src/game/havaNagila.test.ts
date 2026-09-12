import { afterEach, expect, it, vi } from 'vitest'
import { HAVA_LOOP_TICKS, HAVA_MELODY, HAVA_TICKS_PER_BEAT } from './havaNagila.ts'
import { adultMemeThemeById, roshHashanahThemeForDate } from '../memeTheme/index.ts'

const { frequencies } = vi.hoisted(() => ({ frequencies: [] as number[] }))
vi.mock('./audio.ts', () => ({
  getMusicOutput: () => ({ gain: { cancelScheduledValues() {}, setTargetAtTime() {} } }),
  getAudioContext: () => ({
    currentTime: 0, sampleRate: 100,
    createOscillator: () => {
      const osc = { frequency: { value: 0 }, connect() {}, stop() {}, start() { frequencies.push(osc.frequency.value) } }
      return osc
    },
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4) }),
    createBufferSource: () => ({ connect() {}, start() {} }),
  }),
}))
import { music } from './music.ts'

afterEach(() => { music.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); frequencies.length = 0 })

it('synthesizes the Kirk melody without loading recordings, and preserves its position', () => {
  vi.useFakeTimers()
  const audio = vi.fn(() => { throw new Error('recordings must not be used') })
  vi.stubGlobal('Audio', audio)
  const theme = adultMemeThemeById('kirk-mode', '2026-09-12')!
  music.playForTheme(theme, true)
  vi.advanceTimersByTime(800)
  expect(frequencies.some(f => Math.abs(f - 440) < 0.1)).toBe(true) // MIDI melody rises E4 -> A4
  const count = frequencies.length
  music.playForTheme(theme, true)
  vi.advanceTimersByTime(100)
  expect(frequencies).toHaveLength(count)
  music.pause()
  vi.advanceTimersByTime(1000)
  expect(frequencies).toHaveLength(count)
  music.resume()
  vi.advanceTimersByTime(800)
  expect(frequencies.some(f => Math.abs(f - 523.25) < 0.1)).toBe(true) // C5
  expect(audio).not.toHaveBeenCalled()
  music.stop()
  const stopped = frequencies.length
  vi.advanceTimersByTime(1000)
  expect(frequencies).toHaveLength(stopped)
})

it('contains the opening pitches, rests and all three sections', () => {
  expect([...HAVA_MELODY.values()].slice(0, 6)).toEqual([
    [64, 1], [64, 1], [null, 0.5], [68, 0.5], [65, 0.5], [64, 0.5],
  ])
  expect(HAVA_LOOP_TICKS / HAVA_TICKS_PER_BEAT).toBe(96)
})

it('plays the melody through mode changes, freezes on pause and stops cleanly', () => {
  vi.useFakeTimers()
  const theme = roshHashanahThemeForDate('2026-09-12')!
  const tickMs = 60_000 / theme.musicPlan.bpm / HAVA_TICKS_PER_BEAT
  music.playForTheme(theme, false)
  vi.advanceTimersByTime(tickMs + 1)
  expect(frequencies[0]).toBeCloseTo(329.63, 1) // E4, not the old A4 riff.
  music.pause()
  const count = frequencies.length
  vi.advanceTimersByTime(2000)
  expect(frequencies).toHaveLength(count)
  music.resume()
  music.playForTheme(theme, false)
  vi.advanceTimersByTime(tickMs * 2)
  expect(frequencies).toHaveLength(count) // does not restart the first note
  vi.advanceTimersByTime(1200)
  expect(frequencies.some(f => Math.abs(f - 415.3) < 0.1)).toBe(true) // G#4
  music.stop()
  const stopped = frequencies.length
  vi.advanceTimersByTime(2000)
  expect(frequencies).toHaveLength(stopped)
})
