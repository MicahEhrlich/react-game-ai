import type { ScoreNote } from './bibiMusic.ts'
import { envelopeGainAt, noteEnvelope, noteFrequencyAt, pulseCoefficients, scoreNoise } from './scoreSynthesis.ts'

/** Look ahead on the audio clock, so timer jitter cannot stretch the loop. */
export class ScorePlayer {
  private timer: ReturnType<typeof setTimeout> | null = null
  private active = false
  private paused = false
  private epoch: number | null = null
  private offset = 0
  private next = 0
  private cycle = 0
  private sources = new Set<AudioScheduledSourceNode>()
  private readonly notes: readonly ScoreNote[]
  private readonly length: number
  private readonly context: () => AudioContext | null
  private readonly output: () => AudioNode | null

  constructor(notes: readonly ScoreNote[], length: number, context: () => AudioContext | null, output: () => AudioNode | null) {
    this.notes = notes
    this.length = length
    this.context = context
    this.output = output
  }

  play(): void {
    this.stop()
    this.active = true
    this.pump()
  }

  stop(): void {
    this.active = false
    this.paused = false
    this.cancel()
    this.epoch = null
    this.offset = 0
    this.next = 0
    this.cycle = 0
  }

  pause(): void {
    if (!this.active || this.paused) return
    const ctx = this.context()
    if (ctx && this.epoch !== null) this.offset = Math.max(0, ctx.currentTime - this.epoch) % this.length
    this.paused = true
    this.cancel()
    this.epoch = null
  }

  resume(): void {
    if (!this.active || !this.paused) return
    this.paused = false
    this.next = 0
    this.cycle = 0
    this.pump()
  }

  private cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    for (const source of this.sources) source.stop()
    this.sources.clear()
  }

  private pump = (): void => {
    if (!this.active || this.paused) return
    const ctx = this.context()
    const out = this.output()
    if (ctx && out) {
      if (this.epoch === null) this.epoch = ctx.currentTime - this.offset
      const now = ctx.currentTime
      // Catch up after a background-tab delay without emitting a burst.
      const elapsed = Math.max(0, now - this.epoch)
      if (this.cycle < Math.floor(elapsed / this.length)) {
        this.cycle = Math.floor(elapsed / this.length)
        this.next = 0
      }
      while (true) {
        const note = this.notes[this.next]
        const at = this.epoch + this.cycle * this.length + note.at
        if (at > now + 0.1) break
        const elapsedNote = Math.max(0, now - at)
        if (elapsedNote < note.duration) this.schedule(ctx, out, note, Math.max(now, at), elapsedNote)
        if (++this.next === this.notes.length) { this.next = 0; this.cycle++ }
      }
    }
    this.timer = setTimeout(this.pump, 25)
  }

  private schedule(ctx: AudioContext, out: AudioNode, note: ScoreNote, at: number, elapsed: number): void {
    const duration = note.duration - elapsed
    const gain = ctx.createGain()
    const source = note.wave === 'noise' ? ctx.createBufferSource() : ctx.createOscillator()
    if ('frequency' in source) {
      source.type = note.wave as OscillatorType
      source.frequency.value = noteFrequencyAt(note, elapsed)
      if (note.endMidi !== undefined) {
        source.frequency.setValueAtTime(noteFrequencyAt(note, elapsed), at)
        source.frequency.exponentialRampToValueAtTime(noteFrequencyAt(note, note.duration), at + duration)
      }
      if (note.wave === 'square' && note.pulseWidth === 0.25) {
        const { real, imag } = pulseCoefficients(note.pulseWidth)
        source.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: true }))
      }
    } else {
      const buffer = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * duration)), ctx.sampleRate)
      const data = buffer.getChannelData(0)
      data.set(scoreNoise(data.length, ctx.sampleRate, note.noiseColor))
      source.buffer = buffer
    }
    const envelope = noteEnvelope(note)
    // Resuming or catching up continues the envelope, rather than retriggering its attack.
    gain.gain.setValueAtTime(envelopeGainAt(envelope, elapsed), at)
    for (const point of envelope) {
      if (point.at > elapsed) gain.gain.exponentialRampToValueAtTime(point.gain, at + point.at - elapsed)
    }
    source.connect(gain)
    gain.connect(out)
    this.sources.add(source)
    source.onended = () => { this.sources.delete(source); source.disconnect(); gain.disconnect() }
    source.start(at)
    source.stop(at + duration)
  }
}
