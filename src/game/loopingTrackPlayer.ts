/** Lazily decoded file music, routed through the game's existing music gain. */
export class LoopingTrackPlayer {
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private loading: Promise<void> | null = null
  private waitTimer: ReturnType<typeof setTimeout> | null = null
  private active = false
  private paused = false
  private offset = 0
  private startedAt = 0
  private readonly url: string
  private readonly context: () => AudioContext | null
  private readonly output: () => AudioNode | null

  constructor(url: string, context: () => AudioContext | null, output: () => AudioNode | null) {
    this.url = url
    this.context = context
    this.output = output
  }

  play(): void {
    this.stop()
    this.active = true
    this.ensureStarted()
  }

  pause(): void {
    if (!this.active || this.paused) return
    const ctx = this.context()
    if (ctx && this.source && this.buffer) {
      this.offset = (this.offset + Math.max(0, ctx.currentTime - this.startedAt)) % this.buffer.duration
    }
    this.paused = true
    this.cancelSource()
  }

  resume(): void {
    if (!this.active || !this.paused) return
    this.paused = false
    this.ensureStarted()
  }

  stop(): void {
    this.active = false
    this.paused = false
    this.offset = 0
    this.cancelSource()
  }

  private cancelSource(): void {
    if (this.waitTimer !== null) clearTimeout(this.waitTimer)
    this.waitTimer = null
    if (this.source) {
      this.source.stop()
      this.source.disconnect()
      this.source = null
    }
  }

  private ensureStarted = (): void => {
    this.waitTimer = null
    if (!this.active || this.paused || this.source) return
    const ctx = this.context()
    const output = this.output()
    if (!ctx || !output) {
      this.waitTimer = setTimeout(this.ensureStarted, 50)
      return
    }
    if (this.buffer) {
      const source = ctx.createBufferSource()
      source.buffer = this.buffer
      source.loop = true
      source.playbackRate.value = 1
      source.connect(output)
      this.startedAt = ctx.currentTime
      this.source = source
      source.start(0, this.offset)
      return
    }
    if (this.loading) return
    this.loading = (async () => {
      try {
        const response = await fetch(this.url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        this.buffer = await ctx.decodeAudioData(await response.arrayBuffer())
      } catch (error) {
        console.warn(`Unable to load music track ${this.url}`, error)
      } finally {
        this.loading = null
      }
      // A scene change, pause, or quit during loading must not start stale playback.
      if (this.buffer) this.ensureStarted()
    })()
  }
}
