import {
  MEME_THEME_SOURCE,
  OFFLINE_MEME_THEMES,
  OFFLINE_MEME_THEME_IDS,
  normaliseMemeTheme,
  offlineMemeThemeById,
  offlineMemeThemeForDate,
  ALL_MEME_SPRITE_ROLES,
} from '../src/memeTheme/index.ts'
import { fetchLiveMemeTheme, loadDailyMemeTheme } from '../src/memeTheme/daily.ts'
import type { MemeThemeFetch, MemeThemeStorage } from '../src/memeTheme/daily.ts'

let failures = 0

function fail(msg: string): void {
  console.error(`  FAIL  ${msg}`)
  failures++
}

function response(status: number, body: unknown, type = 'application/json') {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? type : null) },
    json: async () => body,
  }
}

function memoryStorage(): MemeThemeStorage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v)
    },
  }
}

const validDraft = {
  id: 'daily-feed',
  label: 'DAILY FEED',
  palette: ['#3ef0ff', '#ff3ea5', '#ffe14d'],
  shiftLines: ['THE FEED BLINKED FIRST'],
  taunts: ['ENGAGEMENT BAIT EVADED'],
  modeFlavor: {
    platformer: {
      enemy: 'FEED BOT',
      obstacle: 'BAD TAKE',
      hazard: 'HOT TAKE',
      projectile: 'REPLY',
      brick: 'THREAD',
    },
    shooter: {
      enemy: 'BOT SWARM',
      obstacle: 'AD BREAK',
      hazard: 'TRENDING',
      projectile: 'QUOTE POST',
      brick: 'THREAD',
    },
    runner: {
      enemy: 'FEED BOT',
      obstacle: 'AUTO PLAY',
      hazard: 'SCROLL TRAP',
      projectile: 'PING',
      brick: 'THREAD',
    },
    brick: {
      enemy: 'MOD BOT',
      obstacle: 'COMMENT',
      hazard: 'RATIO',
      projectile: 'DUNK',
      brick: 'TAKE WALL',
    },
  },
  spritePack: OFFLINE_MEME_THEMES[0].spritePack,
  musicPlan: OFFLINE_MEME_THEMES[0].musicPlan,
}

console.log('validate-meme-theme')

{
  const seen = new Set<string>()
  for (const id of OFFLINE_MEME_THEME_IDS) {
    if (!/^[a-z0-9-]+$/.test(id)) fail(`offline theme id ${id} is not URL-safe`)
    if (seen.has(id)) fail(`duplicate offline theme id ${id}`)
    seen.add(id)
  }
  if (seen.size !== OFFLINE_MEME_THEMES.length) fail('offline theme id export drifted')
}

for (const t of OFFLINE_MEME_THEMES) {
  const theme = normaliseMemeTheme(t, '2026-08-27', MEME_THEME_SOURCE.Offline)
  if (!theme) {
    fail(`offline theme ${t.id} does not validate`)
  } else if (!theme.spritePack) {
    fail(`offline theme ${t.id} has no sprite pack`)
  } else if (!theme.musicPlan) {
    fail(`offline theme ${t.id} has no music plan`)
  } else {
    for (const role of ALL_MEME_SPRITE_ROLES) {
      if (!theme.spritePack[role]) fail(`offline theme ${t.id} is missing ${role}`)
    }
  }
}

{
  const sixSeven = offlineMemeThemeById('six-seven', '2026-08-27')
  if (!sixSeven || sixSeven.label !== 'SIX SEVEN' || !sixSeven.spritePack || !sixSeven.musicPlan) {
    fail('offlineMemeThemeById did not return a valid SIX SEVEN theme')
  }
  const algo = offlineMemeThemeById('algorithm-soup', '2026-08-27')
  if (!algo?.spritePack) fail('offlineMemeThemeById did not return algorithm sprite pack')
  if (sixSeven?.spritePack === algo?.spritePack) fail('SIX SEVEN still reuses the algorithm sprite pack object')
  if (sixSeven?.spritePack?.platformerEnemy === algo?.spritePack?.platformerEnemy) {
    fail('SIX SEVEN platformer enemy still reuses algorithm art')
  }
  if (sixSeven?.spritePack?.shooterEnemy === algo?.spritePack?.shooterEnemy) {
    fail('SIX SEVEN shooter enemy still reuses algorithm art')
  }
  if (sixSeven?.spritePack?.runnerObstacle === algo?.spritePack?.runnerObstacle) {
    fail('SIX SEVEN runner obstacle still reuses algorithm art')
  }
  if (offlineMemeThemeById('not-a-theme', '2026-08-27') !== null) {
    fail('offlineMemeThemeById accepted an invalid id')
  }
}

{
  const byId = new Map(OFFLINE_MEME_THEMES.map((t) => [t.id, t]))
  const trendIds = ['six-seven', 'rizz-circuit', 'npc-stream'] as const
  for (const id of trendIds) {
    const theme = byId.get(id)
    if (!theme?.spritePack) fail(`${id} has no sprite pack`)
    for (const other of OFFLINE_MEME_THEMES) {
      if (other.id !== id && other.spritePack === theme?.spritePack) {
        fail(`${id} reuses sprite pack object from ${other.id}`)
      }
    }
  }
}

for (const date of ['2026-08-27', '2026-08-28', '2027-01-01']) {
  if (!normaliseMemeTheme(offlineMemeThemeForDate(date), date, MEME_THEME_SOURCE.Offline)) {
    fail(`offline fallback for ${date} did not produce a valid theme`)
  }
}

const badCases: readonly [string, unknown][] = [
  ['garbage', 'nope'],
  ['bad color', { ...validDraft, palette: ['red', '#3ef0ff'] }],
  ['oversized label', { ...validDraft, label: 'THIS LABEL IS MUCH TOO LONG FOR THE HUD' }],
  ['markup', { ...validDraft, shiftLines: ['<b>NOPE</b>'] }],
  ['url', { ...validDraft, taunts: ['visit https://example.com'] }],
  ['missing mode', { ...validDraft, modeFlavor: { platformer: validDraft.modeFlavor.platformer } }],
  ['blocked word', { ...validDraft, taunts: ['KILL YOURSELF'] }],
  ['missing music', { ...validDraft, musicPlan: undefined }],
  ['bad bpm', { ...validDraft, musicPlan: { ...validDraft.musicPlan, bpm: 1000 } }],
  ['bad scale', { ...validDraft, musicPlan: { ...validDraft.musicPlan, scale: 'phrygian' } }],
  ['bad note', { ...validDraft, musicPlan: { ...validDraft.musicPlan, leadPattern: [0, 9] } }],
  ['bad drum', { ...validDraft, musicPlan: { ...validDraft.musicPlan, drumPattern: [1, 5] } }],
  ['missing live sprite pack', { ...validDraft, spritePack: undefined }],
  [
    'short sprite row',
    {
      ...validDraft,
      spritePack: {
        ...validDraft.spritePack,
        ball: ['................', 'short'],
      },
    },
  ],
  [
    'unknown sprite char',
    {
      ...validDraft,
      spritePack: {
        ...validDraft.spritePack,
        ball: [
          '................',
          '................',
          '................',
          '................',
          '......zzzz......',
          '.....zwwwwz.....',
          '....zwwccwwz....',
          '....zwccccwz....',
          '....zwccccwz....',
          '....zwwccwwz....',
          '.....zwwwwz.....',
          '......zzzz......',
          '................',
          '................',
          '................',
          '................',
        ],
      },
    },
  ],
]

for (const [name, raw] of badCases) {
  if (normaliseMemeTheme(raw, '2026-08-27', MEME_THEME_SOURCE.Live)) {
    fail(`${name} was accepted`)
  }
}

{
  const theme = await fetchLiveMemeTheme('2026-08-27', async () => response(200, validDraft))
  if (!theme || theme.source !== MEME_THEME_SOURCE.Live || theme.date !== '2026-08-27' || !theme.spritePack || !theme.musicPlan) {
    fail('valid live response was not accepted')
  }
}

const failingFetchers: readonly [string, MemeThemeFetch][] = [
  ['204', async () => response(204, null)],
  ['html 200', async () => response(200, '<html></html>', 'text/html')],
  ['garbage json', async () => response(200, { ...validDraft, palette: ['nope'] })],
  ['throw', async () => {
    throw new Error('quota')
  }],
]

for (const [name, fetcher] of failingFetchers) {
  const theme = await loadDailyMemeTheme('2026-08-27', fetcher, memoryStorage())
  if (theme.source !== MEME_THEME_SOURCE.Offline || !theme.spritePack || !theme.musicPlan) {
    fail(`${name} did not fall back offline with sprites and music`)
  }
}

{
  let calls = 0
  const store = memoryStorage()
  const fetcher: MemeThemeFetch = async () => {
    calls++
    return response(204, null)
  }
  await loadDailyMemeTheme('2026-08-27', fetcher, store)
  await loadDailyMemeTheme('2026-08-27', fetcher, store)
  if (calls !== 1) fail(`daily failed-attempt cache called fetch ${calls} times`)
}

{
  let calls = 0
  const theme = await loadDailyMemeTheme(
    '2026-08-27',
    async () => {
      calls++
      return response(200, validDraft)
    },
    memoryStorage(),
    'six-seven',
  )
  if (theme.id !== 'six-seven' || theme.source !== MEME_THEME_SOURCE.Offline) {
    fail('forced offline meme id did not win over live fetch')
  }
  if (calls !== 0) fail('forced offline meme id still called live fetch')
}

{
  let calls = 0
  const theme = await loadDailyMemeTheme(
    '2026-08-27',
    async () => {
      calls++
      return response(200, validDraft)
    },
    memoryStorage(),
    'not-a-theme',
  )
  if (theme.source !== MEME_THEME_SOURCE.Live) fail('invalid forced meme id did not fall back to normal daily flow')
  if (calls !== 1) fail('invalid forced meme id did not attempt live fetch')
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  daily meme themes validate and fall back offline')
