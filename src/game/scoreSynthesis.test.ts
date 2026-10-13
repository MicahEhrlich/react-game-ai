import { describe, expect, it } from 'vitest'
import { envelopeGainAt, noteEnvelope, noteFrequencyAt, pulseCoefficients, scoreNoise } from './scoreSynthesis.ts'

describe('8-bit accompaniment synthesis', () => {
  it('holds harmony through the middle of a chord and releases to near silence', () => {
    const note = { at: 0, duration: 1, midi: 60, wave: 'square' as const, gain: 0.02, envelope: 'held' as const }
    const points = noteEnvelope(note)
    expect(envelopeGainAt(points, 0.3)).toBeCloseTo(envelopeGainAt(points, 0.8))
    expect(envelopeGainAt(points, 1)).toBeLessThan(note.gain / 100)
    const short = noteEnvelope({ ...note, duration: 0.015 })
    expect(short.every((point, i) => point.at >= (short[i - 1]?.at ?? 0) && point.at <= 0.015 && point.gain > 0)).toBe(true)
  })
  it('keeps accompaniment pitch constant while a kick drops smoothly', () => {
    const note = { at: 0, duration: 0.12, midi: 45, wave: 'triangle' as const, gain: 0.03 }
    expect(noteFrequencyAt(note, 0)).toBe(noteFrequencyAt(note, 0.1))
    const kick = { ...note, endMidi: 24 }
    expect(noteFrequencyAt(kick, 0)).toBeGreaterThan(noteFrequencyAt(kick, 0.06))
    expect(noteFrequencyAt(kick, 0.06)).toBeGreaterThan(noteFrequencyAt(kick, 0.12))
  })
  it('gives the quarter-duty pulse a distinct NES tone without a DC component', () => {
    const quarter = pulseCoefficients(0.25)
    const square = pulseCoefficients(0.5)
    expect(quarter.real[0]).toBe(0)
    expect(quarter.imag[0]).toBe(0)
    expect(Math.abs(quarter.imag[2])).toBeGreaterThan(0.5)
    expect(Math.abs(square.imag[2])).toBeLessThan(1e-7)
  })
  it('separates bright hat transients from a more rounded snare sound', () => {
    const generator = () => { let index = 0; return () => (index++ % 8) / 7 }
    const hat = scoreNoise(128, 22050, 'hat', generator())
    const snare = scoreNoise(128, 22050, 'snare', generator())
    expect(Array.from(hat).every(Number.isFinite)).toBe(true)
    expect(Array.from(snare).every(Number.isFinite)).toBe(true)
    expect(Array.from(hat)).not.toEqual(Array.from(snare))
  })
})
