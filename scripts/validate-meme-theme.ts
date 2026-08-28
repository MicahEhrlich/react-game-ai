import {
  MEME_THEME_SOURCE,
  OFFLINE_MEME_THEMES,
  normaliseMemeTheme,
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
}

console.log('validate-meme-theme')

for (const t of OFFLINE_MEME_THEMES) {
  const theme = normaliseMemeTheme(t, '2026-08-27', MEME_THEME_SOURCE.Offline)
  if (!theme) {
    fail(`offline theme ${t.id} does not validate`)
  } else if (!theme.spritePack) {
    fail(`offline theme ${t.id} has no sprite pack`)
  } else {
    for (const role of ALL_MEME_SPRITE_ROLES) {
      if (!theme.spritePack[role]) fail(`offline theme ${t.id} is missing ${role}`)
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
  if (!theme || theme.source !== MEME_THEME_SOURCE.Live || theme.date !== '2026-08-27' || !theme.spritePack) {
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
  if (theme.source !== MEME_THEME_SOURCE.Offline) fail(`${name} did not fall back offline`)
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

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  daily meme themes validate and fall back offline')
