/**
 * Tiny WebAudio SFX engine. Every sound here is a short oscillator envelope --
 * no binary assets, no loader, nothing that can delay boot. The AudioContext
 * is created lazily and must be unlocked by a user gesture (browser autoplay
 * policy) -- call unlockAudio() from the first keydown/pointerdown.
 *
 * Voice taunts are the one place we do use files, and they are loaded lazily
 * and optionally by taunts.ts -- see that file for why nothing breaks when
 * they are absent.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null

export function getAudioContext(): AudioContext | null {
  return ctx
}

export function getMaster(): GainNode | null {
  return master
}

export function unlockAudio(): void {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.8
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

type Wave = 'square' | 'sawtooth' | 'triangle' | 'sine'

function beep(
  freq: number,
  durationMs: number,
  startDelayMs = 0,
  volume = 0.12,
  type: Wave = 'square',
  endFreq?: number,
): void {
  if (!ctx || !master) return // not unlocked yet -- silently skip rather than throw
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq

  const start = ctx.currentTime + startDelayMs / 1000
  const end = start + durationMs / 1000

  if (endFreq !== undefined) {
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), end)
  }

  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, end)

  osc.connect(gain)
  gain.connect(master)
  osc.start(start)
  osc.stop(end)
}

/** Burst of filtered white noise -- used for the glitch/corruption texture. */
function noise(durationMs: number, volume = 0.1, startDelayMs = 0): void {
  if (!ctx || !master) return
  const frames = Math.floor((ctx.sampleRate * durationMs) / 1000)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

  const src = ctx.createBufferSource()
  src.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  filter.Q.value = 0.7

  const gain = ctx.createGain()
  const start = ctx.currentTime + startDelayMs / 1000
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + durationMs / 1000)

  src.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  src.start(start)
}

export const sfx = {
  jump: () => beep(660, 90),
  land: () => beep(180, 50, 0, 0.06, 'triangle'),
  pickup: () => beep(880, 70),
  shoot: () => beep(920, 60, 0, 0.07, 'square', 420),
  enemyShoot: () => beep(300, 80, 0, 0.05, 'sawtooth', 180),
  explode: () => noise(220, 0.14),
  hurt: () => beep(140, 220, 0, 0.16, 'sawtooth'),
  slide: () => noise(160, 0.06),

  /** Rising arpeggio when the multiplier steps up. */
  multiplier: (step: number) => {
    const base = 520 + Math.min(step, 8) * 40
    ;[base, base * 1.25, base * 1.5].forEach((f, i) => beep(f, 70, i * 45, 0.08))
  },

  /** Three-tone warning that a shift is imminent. */
  shiftWarning: () => {
    ;[880, 880, 880].forEach((f, i) => beep(f, 60, i * 220, 0.07, 'square'))
  },

  /** The mode-shift itself: noise sweep plus a detuned descending pair. */
  glitch: () => {
    noise(500, 0.16)
    noise(300, 0.1, 260)
    beep(1200, 420, 0, 0.1, 'sawtooth', 90)
    beep(1180, 420, 30, 0.08, 'square', 84)
  },

  gameOver: () => {
    ;[440, 350, 262, 180].forEach((f, i) => beep(f, 260, i * 170, 0.13, 'triangle'))
  },
}
