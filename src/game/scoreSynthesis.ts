import type { ScoreNote } from './bibiMusic.ts'

export interface EnvelopePoint { readonly at: number; readonly gain: number }

/** Shared by live Web Audio scheduling and the standalone audition renderer. */
export function noteEnvelope(note: ScoreNote): readonly EnvelopePoint[] {
  const floor = Math.max(1e-7, note.gain * 0.001)
  const attack = Math.min(note.attack ?? 0.004, note.duration * 0.15)
  if (note.envelope !== 'held') return [
    { at: 0, gain: floor }, { at: attack, gain: note.gain }, { at: note.duration, gain: floor },
  ]
  const decay = Math.min(0.025, note.duration * 0.15)
  const release = Math.min(note.release ?? 0.07, note.duration * 0.3)
  return [
    { at: 0, gain: floor }, { at: attack, gain: note.gain },
    { at: attack + decay, gain: note.gain * 0.72 },
    { at: note.duration - release, gain: note.gain * 0.72 }, { at: note.duration, gain: floor },
  ]
}

export function envelopeGainAt(points: readonly EnvelopePoint[], time: number): number {
  if (time <= 0) return points[0].gain
  for (let i = 1; i < points.length; i++) {
    if (time <= points[i].at) {
      const before = points[i - 1]
      const after = points[i]
      const span = after.at - before.at
      return span <= 0 ? after.gain : before.gain * (after.gain / before.gain) ** ((time - before.at) / span)
    }
  }
  return points[points.length - 1].gain
}

export function midiFrequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12) }

export function noteFrequencyAt(note: ScoreNote, time: number): number {
  const frequency = midiFrequency(note.midi)
  return note.endMidi === undefined ? frequency
    : frequency * (midiFrequency(note.endMidi) / frequency) ** (Math.min(note.duration, Math.max(0, time)) / note.duration)
}

/** Fourier coefficients for a DC-free NES-style pulse, shared with WAV rendering. */
export function pulseCoefficients(duty: number, harmonics = 64): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) {
    real[n] = 2 * Math.sin(2 * Math.PI * n * duty) / (Math.PI * n)
    imag[n] = 2 * (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n)
  }
  return { real, imag }
}

/** Filter noise rather than using the same broadband hiss for every drum. */
export function scoreNoise(length: number, rate: number, color: ScoreNote['noiseColor'], random = Math.random): Float32Array {
  const data = new Float32Array(length)
  const cutoff = color === 'hat' ? 4500 : 650
  const highAlpha = rate / (rate + 2 * Math.PI * cutoff)
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * 4200 / rate)
  let lastWhite = 0
  let high = 0
  let low = 0
  for (let i = 0; i < length; i++) {
    const white = random() * 2 - 1
    high = highAlpha * (high + white - lastWhite)
    lastWhite = white
    low += lowAlpha * (high - low)
    data[i] = color === 'hat' ? high : color === 'snare' ? low : white
  }
  return data
}
