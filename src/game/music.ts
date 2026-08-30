import { getAudioContext, getMusicOutput } from './audio.ts'
import { audioSettings } from './audioSettings.ts'
import type { MemeMusicPlan, MusicScale, MusicWave } from '../memeTheme/index.ts'

const BASE = 55
const STEP_MS = 0.08
const RUNNING_GAIN = 0.42

const INTERVALS: Record<MusicScale, readonly number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  pentatonic: [0, 3, 5, 7, 10, 12, 15, 17],
  chromatic: [0, 1, 3, 5, 6, 7, 10, 12],
}

let timer: number | null = null
let step = 0
let current: MemeMusicPlan | null = null
let muted = false

function freq(plan: MemeMusicPlan, degree: number, octave: number): number {
  const intervals = INTERVALS[plan.scale]
  const semis = intervals[Math.max(0, Math.min(intervals.length - 1, degree))] + octave * 12
  return BASE * 2 ** (semis / 12)
}

function tone(
  frequency: number,
  duration: number,
  volume: number,
  type: MusicWave,
  attack = 0.004,
): void {
  const ctx = getAudioContext()
  const out = getMusicOutput()
  if (!ctx || !out || muted) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const now = ctx.currentTime
  osc.type = type
  osc.frequency.value = frequency
  g.gain.setValueAtTime(0.001, now)
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + attack)
  g.gain.exponentialRampToValueAtTime(0.001, now + duration)
  osc.connect(g)
  g.connect(out)
  osc.start(now)
  osc.stop(now + duration)
}

function noise(volume: number): void {
  const ctx = getAudioContext()
  const out = getMusicOutput()
  if (!ctx || !out || muted) return
  const frames = Math.floor(ctx.sampleRate * 0.035)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  const g = ctx.createGain()
  src.buffer = buffer
  g.gain.value = volume
  src.connect(g)
  g.connect(out)
  src.start()
}

function chord(plan: MemeMusicPlan, degree: number, beat: number, level: number): void {
  const wave = plan.padWave ?? 'sine'
  tone(freq(plan, degree, 2), beat * 1.85, level * 0.34, wave, 0.035)
  tone(freq(plan, Math.min(7, degree + 2), 2), beat * 1.85, level * 0.23, wave, 0.035)
  tone(freq(plan, Math.min(7, degree + 4), 2), beat * 1.85, level * 0.18, wave, 0.035)
}

function playDrum(plan: MemeMusicPlan, hit: number, level: number): void {
  const kit = plan.drumKit ?? 'arcade'
  if (hit === 0) return
  if (kit === 'march') {
    if (hit === 1) tone(82, 0.085, level * 1.35, 'sine')
    else if (hit === 2) {
      tone(150, 0.05, level * 0.9, 'triangle')
      noise(level * 0.82)
    } else if (hit === 3) tone(320, 0.03, level * 0.38, 'triangle')
    else {
      tone(220, 0.07, level * 0.95, 'triangle')
      noise(level * 0.68)
    }
    return
  }
  if (kit === 'dance') {
    if (hit === 1) tone(58, 0.09, level * 1.6, 'sine')
    else if (hit === 2) noise(level * 1.0)
    else if (hit === 3) noise(level * 0.25)
    else tone(240, 0.045, level * 0.8, 'square')
    return
  }
  if (kit === 'noir') {
    if (hit === 1) tone(64, 0.08, level * 0.9, 'sine')
    else if (hit === 2) noise(level * 0.45)
    else if (hit === 3) noise(level * 0.16)
    else tone(120, 0.08, level * 0.35, 'sine')
    return
  }
  if (kit === 'glitch') {
    if (hit === 1) tone(70 + (step % 3) * 18, 0.045, level * 1.4, 'square')
    else if (hit === 2) noise(level * 1.0)
    else if (hit === 3) noise(level * 0.38)
    else {
      tone(180 + (step % 4) * 45, 0.035, level, 'sawtooth')
      noise(level * 0.75)
    }
    return
  }
  if (hit === 1) tone(70, 0.055, level * 1.4, 'sine')
  else if (hit === 2) noise(level * 0.9)
  else if (hit === 3) noise(level * 0.35)
  else {
    tone(180, 0.04, level, 'triangle')
    noise(level * 0.7)
  }
}

function tick(): void {
  if (!current) return
  const i = step++
  const beat = 60 / current.bpm
  const level = 0.025 + current.intensity * 0.035
  const bass = current.bassPattern[i % current.bassPattern.length]
  const lead = current.leadPattern[i % current.leadPattern.length]
  const pad = current.padPattern?.[i % current.padPattern.length]
  const chordRoot = current.chordPattern?.[i % current.chordPattern.length]
  const drumHit = current.drumPattern[i % current.drumPattern.length]

  if (bass >= 0 && i % 2 === 0) tone(freq(current, bass, 1), beat * 0.68, level * 1.08, current.bassWave ?? 'sawtooth')
  if (lead >= 0) tone(freq(current, lead, 3), beat * 0.4, level * 0.74, current.leadWave ?? 'square')
  if (pad !== undefined && pad >= 0 && i % 4 === 0) tone(freq(current, pad, 2), beat * 2.25, level * 0.34, current.padWave ?? 'sine', 0.04)
  if (chordRoot !== undefined && chordRoot >= 0 && i % 4 === 0) chord(current, chordRoot, beat, level)
  playDrum(current, drumHit, level)
  reschedule()
}

function reschedule(): void {
  if (timer !== null) {
    if (typeof window.clearTimeout === 'function') window.clearTimeout(timer)
    else window.clearInterval(timer)
  }
  if (!current) {
    timer = null
    return
  }
  const swing = current.swing ?? 0
  const swingMul = step % 2 === 0 ? 1 - swing : 1 + swing
  const interval = Math.max(60, ((60_000 / current.bpm) / 2) * swingMul)
  timer =
    typeof window.setTimeout === 'function'
      ? window.setTimeout(tick, interval)
      : window.setInterval(tick, interval)
}

function fadeTo(value: number): void {
  const ctx = getAudioContext()
  const g = getMusicOutput()
  if (!ctx || !g) return
  const target = value * audioSettings.get().musicVolume
  g.gain.cancelScheduledValues(ctx.currentTime)
  g.gain.setTargetAtTime(target, ctx.currentTime, STEP_MS)
}

export const music = {
  play(plan: MemeMusicPlan): void {
    current = plan
    step = 0
    muted = false
    reschedule()
    fadeTo(RUNNING_GAIN)
  },
  stop(): void {
    current = null
    reschedule()
    fadeTo(0)
  },
  pause(): void {
    muted = true
    fadeTo(0)
  },
  resume(): void {
    if (!current) return
    muted = false
    fadeTo(RUNNING_GAIN)
  },
}

audioSettings.subscribe(() => {
  if (!current || muted) return
  fadeTo(RUNNING_GAIN)
})
