import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoopingTrackPlayer } from './loopingTrackPlayer.ts'

function fixture() {
  const sources: { loop: boolean; playbackRate: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = []
  const output = {} as AudioNode
  const ctx = {
    currentTime: 0,
    decodeAudioData: vi.fn(async () => ({ duration: 8 })),
    createBufferSource: () => {
      const source = { buffer: null, loop: false, playbackRate: { value: 0 }, start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn() }
      sources.push(source)
      return source
    },
  }
  const player = new LoopingTrackPlayer('/audio/music/bibi-mode.mp3', () => ctx as unknown as AudioContext, () => output)
  return { ctx, output, sources, player }
}

async function loaded() { for (let i = 0; i < 8; i++) await Promise.resolve() }

describe('looped MP3 music', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })))
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('loads the supplied asset once, loops it at normal speed, and uses the music output', async () => {
    const { player, output, sources, ctx } = fixture()
    player.play()
    await loaded()
    expect(fetch).toHaveBeenCalledWith('/audio/music/bibi-mode.mp3')
    expect(sources[0].loop).toBe(true)
    expect(sources[0].playbackRate.value).toBe(1)
    expect(sources[0].connect).toHaveBeenCalledWith(output)
    expect(sources[0].start).toHaveBeenCalledWith(0, 0)
    player.stop()
    player.play()
    expect(ctx.decodeAudioData).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledOnce()
    expect(sources[1].start).toHaveBeenCalledWith(0, 0)
    player.stop()
  })

  it('resumes at the correct position even after the track has looped', async () => {
    const { player, ctx, sources } = fixture()
    player.play()
    await loaded()
    ctx.currentTime = 11
    player.pause()
    expect(sources[0].stop).toHaveBeenCalledOnce()
    ctx.currentTime = 20
    player.resume()
    expect(sources[1].start).toHaveBeenCalledWith(0, 3)
    ctx.currentTime = 22
    player.pause()
    player.resume()
    expect(sources[2].start).toHaveBeenCalledWith(0, 5)
    player.stop()
  })

  it('does not start a track that finishes loading after quitting or switching themes', async () => {
    const { player, sources } = fixture()
    player.play()
    player.stop()
    await loaded()
    expect(sources).toHaveLength(0)
    player.play()
    expect(sources).toHaveLength(1)
    player.stop()
  })

  it('stays paused if decoding finishes while the game is paused', async () => {
    const { player, sources } = fixture()
    player.play()
    player.pause()
    await loaded()
    expect(sources).toHaveLength(0)
    player.resume()
    expect(sources).toHaveLength(1)
    player.stop()
  })

  it('waits for audio unlock and clears pending retries when stopped', async () => {
    const { ctx, output, sources } = fixture()
    let unlocked = false
    const player = new LoopingTrackPlayer('/audio/music/bibi-mode.mp3',
      () => unlocked ? ctx as unknown as AudioContext : null, () => output)
    player.play()
    expect(fetch).not.toHaveBeenCalled()
    unlocked = true
    await vi.advanceTimersByTimeAsync(50)
    await loaded()
    expect(sources).toHaveLength(1)
    player.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('handles a failed load without starting playback and retries on a new run', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    const { player, sources } = fixture()
    player.play()
    await loaded()
    expect(sources).toHaveLength(0)
    expect(warning).toHaveBeenCalledOnce()
    player.stop()
    player.play()
    await loaded()
    expect(sources).toHaveLength(1)
    player.stop()
  })
})
