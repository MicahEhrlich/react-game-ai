/** Traditional Hava Nagila melody, in E, with a new synth accompaniment.
 * Melody reference: https://it.wikipedia.org/wiki/H%C4%81v%C4%81_N%C4%81g%C4%ABl%C4%81#Testi_e_melodia
 * Durations are quarter-note beats; null is an intentional rest.
 * Kept local: generated AI music retains its bounded 16-step format.
 */
type Note = readonly [midi: number | null, beats: number]
const E = 64, F = 65, G = 68, A = 69, B = 71, C = 72, D = 62
const opening: readonly Note[] = [
  [E, 1], [E, 1], [null, 0.5], [G, 0.5], [F, 0.5], [E, 0.5],
  [G, 1], [G, 1], [null, 0.5], [B, 0.5], [A, 0.5], [G, 0.5],
  [A, 1], [A, 1], [null, 0.5], [C, 0.5], [B, 0.5], [A, 0.5],
]
const endingOne: readonly Note[] = [
  [G, 1], [F, 1 / 3], [E, 1 / 3], [F, 1 / 3],
  [G, 1], [F, 0.25], [E, 0.25], [D, 0.5],
]
const endingTwo: readonly Note[] = [
  [G, 1], [F, 0.25], [E, 0.25], [F, 0.25], [D, 0.25], [E, 2],
]
const second: readonly Note[] = [
  [G, 0.5], [G, 1], [F, 0.5], [E, 0.5], [E, 0.5], [E, 1],
  [F, 0.5], [F, 1], [E, 0.5], [D, 0.5], [D, 0.5], [D, 1],
  [D, 1], [F, 0.75], [E, 0.25], [D, 0.5], [D, 0.5], [A, 1],
]
const danceA: readonly Note[] = [
  [A, 0.25], [A, 0.25], [A, 0.25], [A, 0.25],
  [C, 0.75], [B, 0.25], [A, 0.5], [C, 0.5], [B, 0.5], [A, 0.5],
]
const danceB: readonly Note[] = [
  [B, 0.25], [B, 0.25], [B, 0.25], [B, 0.25],
  [74, 0.75], [C, 0.25], [B, 0.5], [74, 0.5], [C, 0.5], [B, 0.5],
]
const notes: readonly Note[] = [
  ...opening, ...endingOne, ...opening, ...endingTwo,
  ...second, ...endingOne, ...second, ...endingTwo,
  [A, 2], [A, 2], [A, 1], [A, 1], [A, 1], [A, 1],
  ...danceA, ...danceA, ...danceB, ...danceB,
  [B, 0.25], [B, 0.25], [B, 0.25], [B, 0.25], [76, 1], [null, 2],
  [E, 0.5], [E, 0.5], [C, 0.25], [B, 0.25], [A, 0.25], [G, 0.25], [A, 2],
]

export const HAVA_TICKS_PER_BEAT = 12
export const HAVA_MELODY = new Map<number, Note>()
let length = 0
for (const note of notes) {
  HAVA_MELODY.set(length, note)
  length += Math.round(note[1] * HAVA_TICKS_PER_BEAT)
}
export const HAVA_LOOP_TICKS = length
