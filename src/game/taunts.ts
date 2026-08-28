import { getAudioContext, getSfxOutput } from './audio.ts'

/**
 * Optional AI-generated voice taunts. This is the ONLY place the game touches
 * a binary asset, and it is deliberately built so that the asset never
 * matters to correctness:
 *
 *   - nothing is fetched during boot, so a missing or slow file cannot delay
 *     the first frame;
 *   - a fetch is attempted once per clip, in the background, after the audio
 *     context is unlocked;
 *   - if the file is absent (the default state of this repo), `play` falls
 *     back to a synthesised vocoder-ish phrase, so the beat still lands.
 *
 * To add real taunts, drop files at `public/audio/taunts/<id>.webm`. No code
 * change is required.
 */
export const TAUNT = {
  Shift: 'shift',
  Hurt: 'hurt',
  Streak: 'streak',
  GameOver: 'game-over',
} as const
export type TauntId = (typeof TAUNT)[keyof typeof TAUNT]

const URL_FOR: Readonly<Record<TauntId, string>> = {
  [TAUNT.Shift]: '/audio/taunts/shift.webm',
  [TAUNT.Hurt]: '/audio/taunts/hurt.webm',
  [TAUNT.Streak]: '/audio/taunts/streak.webm',
  [TAUNT.GameOver]: '/audio/taunts/game-over.webm',
}

/** Synthesised stand-in: a short formant-ish warble, one per taunt id. */
const FALLBACK_SHAPE: Readonly<Record<TauntId, readonly number[]>> = {
  [TAUNT.Shift]: [420, 300, 500, 260],
  [TAUNT.Hurt]: [300, 220, 180],
  [TAUNT.Streak]: [360, 480, 600, 520],
  [TAUNT.GameOver]: [380, 300, 240, 160, 120],
}

type Slot = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; buffer: AudioBuffer } | { status: 'absent' }

const slots = new Map<TauntId, Slot>()

function slotFor(id: TauntId): Slot {
  return slots.get(id) ?? { status: 'idle' }
}

/**
 * Kick off a background fetch. Safe to call repeatedly; only the first call
 * per id does any work, and a failure is recorded as `absent` so a missing
 * file is not re-requested on every play.
 */
export function prefetchTaunt(id: TauntId): void {
  const ctx = getAudioContext()
  if (!ctx) return // not unlocked yet; prefetch on the next call instead
  if (slotFor(id).status !== 'idle') return

  slots.set(id, { status: 'loading' })
  void (async () => {
    try {
      const res = await fetch(URL_FOR[id])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer())
      slots.set(id, { status: 'ready', buffer })
    } catch {
      // Expected whenever no taunt pack is installed. Not an error condition.
      slots.set(id, { status: 'absent' })
    }
  })()
}

export function playTaunt(id: TauntId, volume = 0.5): void {
  const ctx = getAudioContext()
  const out = getSfxOutput()
  if (!ctx || !out) return

  const slot = slotFor(id)

  if (slot.status === 'ready') {
    const src = ctx.createBufferSource()
    src.buffer = slot.buffer
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(gain)
    gain.connect(out)
    src.start()
    return
  }

  // Not loaded (or never will be): start the fetch for next time and speak
  // the synthesised stand-in now.
  prefetchTaunt(id)
  speakFallback(ctx, out, FALLBACK_SHAPE[id], volume)
}

function speakFallback(
  ctx: AudioContext,
  out: GainNode,
  shape: readonly number[],
  volume: number,
): void {
  shape.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    // A slow LFO on the frequency gives the flat square wave enough wobble to
    // read as a "voice" rather than another game beep.
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 24
    lfoGain.gain.value = freq * 0.06
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)

    osc.type = 'sawtooth'
    osc.frequency.value = freq

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq * 2.2
    filter.Q.value = 4

    const start = ctx.currentTime + i * 0.11
    const end = start + 0.13
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume * 0.25, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, end)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    osc.start(start)
    osc.stop(end)
    lfo.start(start)
    lfo.stop(end)
  })
}
