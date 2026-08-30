import { execFileSync } from 'node:child_process'

const DEFAULT_AUDIO = '/Users/micah/Downloads/we-are-charlie-kirk-song.mp3'
const path = process.argv[2] ?? DEFAULT_AUDIO

const info = execFileSync('afinfo', [path], { encoding: 'utf8' })
const duration = Number(info.match(/estimated duration:\s+([\d.]+)/)?.[1] ?? 0)
const sampleRate = Number(info.match(/(\d+)\s+Hz/)?.[1] ?? 0)
const channels = Number(info.match(/Data format:\s+(\d+)\s+ch/)?.[1] ?? 0)
const bitRate = Number(info.match(/bit rate:\s+(\d+)/)?.[1] ?? 0)

console.log(
  JSON.stringify(
    {
      source: {
        path,
        durationSec: Number(duration.toFixed(3)),
        sampleRate,
        channels,
        bitRate,
      },
      recommendation: {
        bpm: 90,
        scale: 'minor',
        style: 'anthem lament',
        runtimeAssetPolicy: 'reference-only; do not bundle, sample, or play the MP3',
      },
    },
    null,
    2,
  ),
)
