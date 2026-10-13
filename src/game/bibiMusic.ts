/** Instrumental backing reconstructed from BibiSongDuetLove.mp3, 91–124 seconds.
 * Chord roots and pulse timings were measured from the reference recording.
 * No vocal melody, samples, or original recording are included.
 */
export interface ScoreNote {
  readonly at: number
  readonly duration: number
  readonly midi: number
  readonly wave: 'square' | 'triangle' | 'noise'
  readonly gain: number
  readonly part?: 'bass' | 'chords' | 'kick' | 'snare' | 'hat'
  readonly envelope?: 'pluck' | 'held'
  readonly attack?: number
  readonly release?: number
  readonly endMidi?: number
  readonly pulseWidth?: 0.25 | 0.5
  readonly noiseColor?: 'hat' | 'snare'
}

export const BIBI_SOURCE_SECONDS = 33
export const BIBI_TEMPO_MULTIPLIER = 1.06
export const BIBI_LOOP_SECONDS = BIBI_SOURCE_SECONDS / BIBI_TEMPO_MULTIPLIER
// Beat-tracking timestamps lag the accompaniment's attacks by about 45 ms.
export const BACKING_ATTACK_OFFSET = 0.045
export interface BackingChord {
  readonly at: number
  readonly bass: number
  readonly tones: readonly [number, number, number]
}

// Close accompaniment voicings, including the source's G/B passing chords.
export const BACKING_CHORDS: readonly BackingChord[] = [
  { at: 0, bass: 33, tones: [57, 60, 64] },
  { at: 1.486, bass: 35, tones: [55, 59, 62] },
  { at: 2.171, bass: 36, tones: [55, 60, 64] },
  { at: 4.284, bass: 29, tones: [57, 60, 65] },
  { at: 5.7, bass: 38, tones: [57, 62, 65] },
  { at: 8.522, bass: 36, tones: [55, 60, 64] },
  { at: 11.331, bass: 34, tones: [58, 62, 65] },
  { at: 13.456, bass: 33, tones: [57, 60, 64] },
  { at: 18.413, bass: 35, tones: [55, 59, 62] },
  { at: 19.11, bass: 36, tones: [55, 60, 64] },
  { at: 21.211, bass: 29, tones: [57, 60, 65] },
  { at: 22.639, bass: 38, tones: [57, 62, 65] },
  { at: 24.741, bass: 36, tones: [55, 60, 64] },
  { at: 27.585, bass: 34, tones: [58, 62, 65] },
  { at: 30.418, bass: 33, tones: [57, 60, 64] },
]

export const BACKING_PULSES = [
  0.07, 0.395, 0.766, 1.115, 1.486, 1.811, 2.171, 2.519, 2.868, 3.216,
  3.576, 3.924, 4.284, 4.644, 5.004, 5.341, 5.7, 6.049, 6.42, 6.757,
  7.105, 7.454, 7.814, 8.162, 8.522, 8.87, 9.218, 9.578, 9.938, 10.275,
  10.646, 10.983, 11.331, 11.691, 12.04, 12.341, 12.736, 13.096, 13.456,
  13.804, 14.153, 14.501, 14.872, 15.221, 15.569, 15.917, 16.277, 16.625,
  16.985, 17.345, 17.682, 18.042, 18.413, 18.75, 19.11, 19.458, 19.807,
  20.167, 20.515, 20.863, 21.211, 21.571, 21.931, 22.291, 22.639, 22.988,
  23.348, 23.696, 24.033, 24.393, 24.741, 25.101, 25.449, 25.809, 26.146,
  26.517, 26.854, 27.214, 27.585, 27.934, 28.294, 28.63, 28.979, 29.338,
  29.698, 30.047, 30.418, 30.755, 31.115, 31.463, 31.823, 32.171, 32.531, 32.868,
] as const

export function backingPlaybackTime(sourceTime: number): number {
  return Math.max(0, sourceTime - BACKING_ATTACK_OFFSET) / BIBI_TEMPO_MULTIPLIER
}

function backingScore(): readonly ScoreNote[] {
  const notes: ScoreNote[] = []
  const add = (sourceAt: number, sourceDuration: number, midi: number, wave: ScoreNote['wave'], gain: number,
    options: Partial<ScoreNote> = {}, harmonicEnd = BIBI_SOURCE_SECONDS + BACKING_ATTACK_OFFSET) => {
    const at = backingPlaybackTime(sourceAt)
    const end = Math.min(BIBI_LOOP_SECONDS, backingPlaybackTime(harmonicEnd),
      at + sourceDuration / BIBI_TEMPO_MULTIPLIER)
    const duration = end - at
    if (duration <= 0.003) return
    notes.push({ ...options, at, duration, midi, wave, gain })
  }
  // Quiet sustained chord bed. Square-pulse colors stay in the accompaniment register.
  BACKING_CHORDS.forEach((chord, i) => {
    const end = BACKING_CHORDS[i + 1]?.at ?? BIBI_SOURCE_SECONDS + BACKING_ATTACK_OFFSET
    chord.tones.forEach((midi, voice) => add(chord.at, end - chord.at, midi,
      voice === 2 ? 'triangle' : 'square', voice === 2 ? 0.013 : 0.008,
      { part: 'chords', envelope: 'held', attack: 0.018, release: 0.09, ...(voice === 0 ? { pulseWidth: 0.25 as const } : {}) }, end))
    // Reinforce harmonic changes with their actual bass root, rather than a made-up fifth pattern.
    add(chord.at, Math.min(0.28, end - chord.at), chord.bass, 'triangle', 0.059,
      { part: 'bass', envelope: 'held', release: 0.06 }, end)
  })
  BACKING_PULSES.forEach((sourceAt, i) => {
    const chordIndex = BACKING_CHORDS.findLastIndex((c) => c.at <= sourceAt)
    const chord = BACKING_CHORDS[chordIndex]
    const chordEnd = BACKING_CHORDS[chordIndex + 1]?.at ?? BIBI_SOURCE_SECONDS + BACKING_ATTACK_OFFSET
    const span = (BACKING_PULSES[i + 1] ?? BIBI_SOURCE_SECONDS) - sourceAt
    // Source low attacks favor the odd eighths. Keep a relaxed half-time backbeat.
    if (i % 2 === 1) {
      add(sourceAt, span * 1.55, chord.bass, 'triangle', i % 4 === 1 ? 0.073 : 0.058,
        { part: 'bass', envelope: 'held', release: 0.055 }, chordEnd)
      add(sourceAt, 0.115, 45, 'triangle', i % 4 === 1 ? 0.07 : 0.045,
        { part: 'kick', endMidi: 24 })
      // Short staggered chord strums instead of a high, repeating four-note lead.
      chord.tones.forEach((midi, voice) => add(sourceAt + voice * 0.012, span * 0.72, midi,
        'square', 0.009, { part: 'chords', pulseWidth: voice === 0 ? 0.25 : 0.5 }, chordEnd))
    }
    if (i % 4 === 1) {
      add(sourceAt, 0.105, 0, 'noise', 0.045, { part: 'snare', noiseColor: 'snare' })
      add(sourceAt, 0.065, 50, 'triangle', 0.018, { part: 'snare', endMidi: 45 })
    }
    add(sourceAt, 0.027, 0, 'noise', i % 2 ? 0.015 : 0.01, { part: 'hat', noiseColor: 'hat' })
    // A faint sixteenth keeps the arcade pulse moving without taking over the backing.
    if (span > 0.2) add(sourceAt + span / 2, 0.018, 0, 'noise', 0.005, { part: 'hat', noiseColor: 'hat' })
  })
  return notes.sort((a, b) => a.at - b.at)
}

export const BIBI_SCORE = backingScore()
