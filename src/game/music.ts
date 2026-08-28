import { getAudioContext, getMusicOutput } from './audio.ts'
import { audioSettings } from './audioSettings.ts'
import type { MemeMusicPlan, MusicScale } from '../memeTheme/index.ts'

const BASE = 55
const STEP_MS = 0.08

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

function tone(frequency: number, duration: number, volume: number, type: OscillatorType): void {
  const ctx = getAudioContext()
  const out = getMusicOutput()
  if (!ctx || !out || muted) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const now = ctx.currentTime
  osc.type = type
  osc.frequency.value = frequency
  g.gain.setValueAtTime(volume, now)
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

function tick(): void {
  if (!current) return
  const i = step++
  const beat = 60 / current.bpm
  const level = 0.025 + current.intensity * 0.035
  const bass = current.bassPattern[i % current.bassPattern.length]
  const lead = current.leadPattern[i % current.leadPattern.length]
  const drum = current.drumPattern[i % current.drumPattern.length]

  if (bass >= 0 && i % 2 === 0) tone(freq(current, bass, 1), beat * 0.45, level * 0.9, 'sawtooth')
  if (lead >= 0) tone(freq(current, lead, 3), beat * 0.28, level * 0.55, 'square')
  if (drum === 1) tone(70, 0.055, level * 1.4, 'sine')
  else if (drum === 2) noise(level * 0.9)
  else if (drum === 3) noise(level * 0.35)
  else if (drum === 4) {
    tone(180, 0.04, level, 'triangle')
    noise(level * 0.7)
  }
}

function reschedule(): void {
  if (timer !== null) window.clearInterval(timer)
  if (!current) {
    timer = null
    return
  }
  const interval = Math.max(60, (60_000 / current.bpm) / 2)
  timer = window.setInterval(tick, interval)
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
    fadeTo(0.3)
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
    fadeTo(0.3)
  },
}

audioSettings.subscribe(() => {
  if (!current || muted) return
  fadeTo(0.3)
})
