import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScorePlayer } from './scorePlayer.ts'
import { BACKING_CHORDS, backingPlaybackTime, BIBI_SCORE, BIBI_LOOP_SECONDS, BIBI_SOURCE_SECONDS, BIBI_TEMPO_MULTIPLIER } from './bibiMusic.ts'
import { envelopeGainAt, noteEnvelope, noteFrequencyAt } from './scoreSynthesis.ts'

function audioFixture() {
  const starts: { at: number; frequency: number }[] = []
  const sources: { stop: ReturnType<typeof vi.fn> }[] = []
  const gains: { gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> } }[] = []
  const ctx = {
    currentTime: 0, sampleRate: 1000,
    createPeriodicWave: vi.fn(() => ({})),
    createBuffer: vi.fn((_channels: number, length: number, _rate: number) => ({ getChannelData: () => new Float32Array(length) })),
    createBufferSource: () => {
      const source = { buffer: null, connect: vi.fn(), disconnect: vi.fn(), onended: null,
        start: (at: number) => starts.push({ at, frequency: 0 }), stop: vi.fn() }
      sources.push(source)
      return source
    },
    createGain: () => {
      const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }
      gains.push(gain)
      return gain
    },
    createOscillator: () => {
      const source = { frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: '', setPeriodicWave: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
        onended: null, start: (at: number) => starts.push({ at, frequency: source.frequency.value }), stop: vi.fn() }
      sources.push(source)
      return source
    },
  }
  return { ctx, starts, sources, gains }
}

const score = [{ at: 0, duration: 0.2, midi: 60, wave: 'square' as const, gain: 0.03 },
  { at: 2, duration: 0.2, midi: 64, wave: 'triangle' as const, gain: 0.03 }]

describe('timestamped music playback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loops on the audio clock at the fractional, faster duration despite timer jitter', () => {
    const { ctx, starts } = audioFixture()
    const player = new ScorePlayer(score, BIBI_LOOP_SECONDS, () => ctx as unknown as AudioContext, () => ({} as AudioNode))
    player.play()
    expect(starts[0].at).toBe(0)
    ctx.currentTime = BIBI_LOOP_SECONDS - 0.05
    vi.advanceTimersByTime(25)
    expect(starts.at(-1)?.at).toBe(BIBI_LOOP_SECONDS)
    player.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the playhead on pause and cancels scheduled sources', () => {
    const { ctx, starts, sources } = audioFixture()
    const player = new ScorePlayer(score, 33, () => ctx as unknown as AudioContext, () => ({} as AudioNode))
    player.play()
    ctx.currentTime = 1.5
    player.pause()
    expect(sources[0].stop).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    ctx.currentTime = 10
    player.resume()
    ctx.currentTime = 10.45
    vi.advanceTimersByTime(25)
    expect(starts.at(-1)?.at).toBe(10.5)
    player.stop()
    player.play()
    expect(starts.at(-1)?.at).toBe(10.45)
    player.stop()
  })

  it('waits for audio unlock and tolerates repeated stop and pause calls', () => {
    const fixture = audioFixture()
    let unlocked = false
    const player = new ScorePlayer(score, 33, () => unlocked ? fixture.ctx as unknown as AudioContext : null, () => ({} as AudioNode))
    player.play()
    vi.advanceTimersByTime(100)
    expect(fixture.starts).toHaveLength(0)
    unlocked = true
    vi.advanceTimersByTime(25)
    expect(fixture.starts).toHaveLength(1)
    player.pause(); player.pause(); player.stop(); player.stop(); player.resume()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skips elapsed notes after a long tab delay without bursting', () => {
    const { ctx, starts } = audioFixture()
    const player = new ScorePlayer(score, 33, () => ctx as unknown as AudioContext, () => ({} as AudioNode))
    player.play()
    ctx.currentTime = 101
    vi.advanceTimersByTime(25)
    expect(starts.map((s) => s.at)).toEqual([0, 101])
    player.stop()
  })

  it('speeds up the same excerpt without adding a vocal melody or changing harmonic pitches', () => {
    expect(BIBI_SOURCE_SECONDS).toBe(33)
    expect(BIBI_TEMPO_MULTIPLIER).toBe(1.06)
    expect(BIBI_LOOP_SECONDS).toBeCloseTo(33 / 1.06, 8)
    expect(BIBI_SCORE.length).toBeGreaterThan(150)
    for (const note of BIBI_SCORE) {
      expect(note.at).toBeGreaterThanOrEqual(0)
      expect(note.duration).toBeGreaterThan(0)
      expect(note.at + note.duration).toBeLessThanOrEqual(BIBI_LOOP_SECONDS + 1e-9)
      expect(['square', 'triangle', 'noise']).toContain(note.wave)
      expect(['bass', 'chords', 'kick', 'snare', 'hat']).toContain(note.part)
      if (note.part === 'bass' || note.part === 'chords') {
        const index = BACKING_CHORDS.findLastIndex((chord) => backingPlaybackTime(chord.at) <= note.at + 1e-9)
        const chord = BACKING_CHORDS[index]
        expect(note.part === 'bass' ? [chord.bass] : chord.tones).toContain(note.midi)
        const next = BACKING_CHORDS[index + 1]
        if (next) expect(note.at + note.duration).toBeLessThanOrEqual(backingPlaybackTime(next.at) + 1e-9)
      }
    }
  })

  it('continues a held chord envelope after resuming partway through it', () => {
    const { ctx, gains } = audioFixture()
    const note = { at: 0, duration: 2, midi: 60, wave: 'triangle' as const, gain: 0.03, envelope: 'held' as const }
    const player = new ScorePlayer([note], 3, () => ctx as unknown as AudioContext, () => ({} as AudioNode))
    player.play()
    ctx.currentTime = 0.7
    player.pause()
    ctx.currentTime = 10
    player.resume()
    expect(gains.at(-1)?.gain.setValueAtTime).toHaveBeenCalledWith(envelopeGainAt(noteEnvelope(note), 0.7), 10)
    expect(gains.at(-1)?.gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(noteEnvelope(note).at(-1)!.gain, 11.3)
    player.stop()
  })

  it('schedules the downward kick pitch without changing the backing note pitches', () => {
    const { ctx } = audioFixture()
    const source = { type: '', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      setPeriodicWave: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null, start: vi.fn(), stop: vi.fn() }
    ctx.createOscillator = () => source
    const note = { at: 0, duration: 0.115, midi: 45, endMidi: 24, wave: 'triangle' as const, gain: 0.03 }
    const player = new ScorePlayer([note], 1, () => ctx as unknown as AudioContext, () => ({} as AudioNode))
    player.play()
    expect(source.frequency.setValueAtTime).toHaveBeenCalledWith(noteFrequencyAt(note, 0), 0)
    expect(source.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(noteFrequencyAt(note, note.duration), note.duration)
    player.stop()
  })

  it('plays the complete backing with custom pulses and colored noise and cancels all voices', () => {
    const { ctx, sources } = audioFixture()
    const player = new ScorePlayer(BIBI_SCORE, BIBI_LOOP_SECONDS,
      () => ctx as unknown as AudioContext, () => ({} as AudioNode))
    player.play()
    expect(ctx.createPeriodicWave).toHaveBeenCalled()
    ctx.currentTime = 0.35
    vi.advanceTimersByTime(50)
    expect(ctx.createBuffer).toHaveBeenCalled()
    player.stop()
    for (const source of sources) expect(source.stop).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
