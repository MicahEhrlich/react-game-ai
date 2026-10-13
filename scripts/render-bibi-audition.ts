/** Render the game's instrumental score to a WAV for review. No source audio needed. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { BIBI_SCORE, BIBI_LOOP_SECONDS } from '../src/game/bibiMusic.ts'
import { envelopeGainAt, noteEnvelope, midiFrequency, pulseCoefficients, scoreNoise } from '../src/game/scoreSynthesis.ts'

const rate = 22050
const samples = new Float64Array(Math.round(rate * BIBI_LOOP_SECONDS))
let seed = 710
function random(): number {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 0x100000000
}
for (const note of BIBI_SCORE) {
  const frequency = midiFrequency(note.midi)
  const start = Math.round(note.at * rate)
  const count = Math.min(Math.round(note.duration * rate), samples.length - start)
  const envelope = noteEnvelope(note)
  const noise = note.wave === 'noise' ? scoreNoise(count, rate, note.noiseColor, random) : null
  const pulse = pulseCoefficients(note.pulseWidth ?? 0.5)
  const sweep = note.endMidi === undefined ? 0 : Math.log(midiFrequency(note.endMidi) / frequency) / note.duration
  for (let i = 0; i < count; i++) {
    const time = i / rate
    const gain = envelopeGainAt(envelope, time)
    let wave = 0
    if (noise) wave = noise[i]
    else {
      // Integrated frequency keeps the descending kick phase continuous.
      const phase = 2 * Math.PI * (sweep === 0 ? frequency * time : frequency * Math.expm1(sweep * time) / sweep)
      const harmonics = Math.min(64, Math.floor(rate / 2 / frequency))
      for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
        if (note.wave === 'square') {
          wave += pulse.real[harmonic] * Math.cos(harmonic * phase) + pulse.imag[harmonic] * Math.sin(harmonic * phase)
        } else if (harmonic % 2 === 1) {
          const scale = 8 / (Math.PI ** 2) * (-1) ** ((harmonic - 1) / 2) / (harmonic ** 2)
          wave += scale * Math.sin(harmonic * phase)
        }
      }
    }
    samples[start + i] += wave * gain * 0.42 * 0.6 * 0.8
  }
}
const wav = Buffer.alloc(44 + samples.length * 2)
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28)
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40)
for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2)
const path = process.argv[2] ?? 'artifacts/bibi-mode-8bit.wav'
mkdirSync('artifacts', { recursive: true })
writeFileSync(path, wav)
console.log(`Rendered ${BIBI_LOOP_SECONDS.toFixed(3)}s instrumental backing to ${path}`)
