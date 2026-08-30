import { readFileSync } from 'node:fs'
import midiPkg from '@tonejs/midi'

const { Midi } = midiPkg

const DEFAULT_MIDI = '/Users/micah/Downloads/WE ARE CHARLIE KIRK.mid'
const SCALE_PCS = [9, 11, 0, 2, 4, 5, 7, 9] // A natural minor degrees 0..7
const CHORUS_ROOTS = [0, 3, 6, 2, 4, 0, 5, 4] // Am Dm G C E Am F E, as scale-degree roots.

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function nearestDegree(midi: number): number {
  const pc = ((midi % 12) + 12) % 12
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < SCALE_PCS.length; i++) {
    const dist = Math.min(Math.abs(pc - SCALE_PCS[i]), 12 - Math.abs(pc - SCALE_PCS[i]))
    if (dist < bestDist) {
      best = i
      bestDist = dist
    }
  }
  return best
}

function simplifyLead(notes: { midi: number; ticks: number }[], start: number, end: number): number[] {
  const span = Math.max(1, end - start)
  return Array.from({ length: 16 }, (_, step) => {
    const a = start + (span * step) / 16
    const b = start + (span * (step + 1)) / 16
    const candidates = notes.filter((n) => n.ticks >= a && n.ticks < b && n.midi >= 52)
    if (candidates.length === 0) return -1
    candidates.sort((x, y) => y.midi - x.midi)
    return nearestDegree(candidates[0].midi)
  })
}

function interleaveRoots(roots: number[]): number[] {
  return roots.flatMap((root) => [root, -1]).slice(0, 16)
}

function plan(name: string, bpm: number, roots: number[], lead: number[], intensity: number): unknown {
  const pattern = interleaveRoots(roots)
  return {
    style: name,
    bpm,
    scale: 'minor',
    bassPattern: pattern,
    leadPattern: lead,
    padPattern: pattern,
    chordPattern: pattern,
    drumPattern: [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 4, 0],
    bassWave: 'triangle',
    leadWave: 'triangle',
    padWave: 'sine',
    drumKit: 'march',
    intensity,
  }
}

const path = process.argv[2] ?? DEFAULT_MIDI
const midi = new Midi(readFileSync(path))
const bpm = clamp(Math.round(midi.header.tempos[0]?.bpm ?? 110), 90, 180)
const notes = midi.tracks.flatMap((track) => track.notes).sort((a, b) => a.ticks - b.ticks)
const firstTick = notes[0]?.ticks ?? 0
const lastTick = Math.max(...notes.map((n) => n.ticks + n.durationTicks), firstTick + 1)
const span = lastTick - firstTick
const third = span / 3

const mainLead = simplifyLead(notes, firstTick, firstTick + third)
const interludeLead = simplifyLead(notes, firstTick + third, firstTick + third * 2)
const bridgeLead = simplifyLead(notes, firstTick + third * 2, lastTick)

const output = {
  source: {
    path,
    tracks: midi.tracks.length,
    ppq: midi.header.ppq,
    bpm,
    noteCount: notes.length,
    pitchRange: [Math.min(...notes.map((n) => n.midi)), Math.max(...notes.map((n) => n.midi))],
  },
  plans: {
    KirkMarch: plan('anthem lament', bpm, CHORUS_ROOTS, mainLead, 0.78),
    KirkInterlude: plan('anthem rise', bpm, [6, 5, 4, 4, 0, 4, 5, 4], interludeLead, 0.7),
    KirkBridge: plan('anthem bridge', bpm, [3, 0, 3, 0, 3, 0, 5, 4], bridgeLead, 0.76),
  },
}

console.log(JSON.stringify(output, null, 2))
