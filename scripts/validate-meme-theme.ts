import {
  MEME_THEME_SOURCE,
  OFFLINE_MEME_THEMES,
  OFFLINE_MEME_THEME_IDS,
  normaliseMemeTheme,
  offlineMemeThemeById,
  offlineMemeThemeForDate,
  themeBundleForDate,
  ALL_MEME_SPRITE_ROLES,
  ADULT_MEME_THEMES,
  ADULT_MEME_THEME_IDS,
  adultMemeThemeById,
  adultMemeThemeForDate,
  themeForMode,
} from '../src/memeTheme/index.ts'
import { fetchLiveMemeTheme, loadDailyMemeTheme } from '../src/memeTheme/daily.ts'
import type { MemeThemeFetch, MemeThemeStorage } from '../src/memeTheme/daily.ts'
import type { GameMode } from '../src/state/types.ts'
import {
  chooseBestCandidate,
  normaliseCandidateConcepts,
  normaliseMemeReview,
  scoreCandidateConcept,
} from '../server/memeThemeEndpoint.ts'

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

const validModeThemeDraft = {
  ...validDraft,
  modeThemes: {
    runner: {
      label: 'RUNNER FEED',
      palette: ['#4dff9a', '#ffe14d'],
      shiftLines: ['RUNNER GOT PERSONALIZED'],
      taunts: ['RUNNER VARIANT ONLINE'],
      modeFlavor: {
        enemy: 'RUN BOT',
        obstacle: 'RUN CLIP',
        hazard: 'RUN TAX',
        projectile: 'RUN PING',
        brick: 'RUN WALL',
      },
      spritePack: {
        runnerObstacle: OFFLINE_MEME_THEMES[1].spritePack!.runnerObstacle,
      },
      musicPlan: OFFLINE_MEME_THEMES[1].musicPlan,
    },
  },
}

const validBundleDraft = {
  ...validDraft,
  modeThemeBundle: {
    platformer: { ...validDraft, id: 'bundle-platformer', label: 'BUNDLE PLATFORM' },
    shooter: { ...validDraft, id: 'bundle-shooter', label: 'BUNDLE SHOOTER' },
    runner: { ...validDraft, id: 'bundle-runner', label: 'BUNDLE RUNNER' },
    brick: { ...validDraft, id: 'bundle-brick', label: 'BUNDLE BRICK' },
  },
}

const validRotationDraft = {
  ...validDraft,
  themeRotations: {
    platformer: [
      { ...validDraft, id: 'platformer-one', label: 'PLATFORM ONE' },
      { ...validDraft, id: 'platformer-two', label: 'PLATFORM TWO' },
      { ...validDraft, id: 'platformer-three', label: 'PLATFORM THREE' },
    ],
    shooter: [
      { ...validDraft, id: 'shooter-one', label: 'SHOOTER ONE' },
      { ...validDraft, id: 'shooter-two', label: 'SHOOTER TWO' },
      { ...validDraft, id: 'shooter-three', label: 'SHOOTER THREE' },
    ],
    runner: [
      { ...validDraft, id: 'runner-one', label: 'RUNNER ONE' },
      { ...validDraft, id: 'runner-two', label: 'RUNNER TWO' },
      { ...validDraft, id: 'runner-three', label: 'RUNNER THREE' },
    ],
    brick: [
      { ...validDraft, id: 'brick-one', label: 'BRICK ONE' },
      { ...validDraft, id: 'brick-two', label: 'BRICK TWO' },
      { ...validDraft, id: 'brick-three', label: 'BRICK THREE' },
    ],
  },
}

const validCandidates = {
  candidates: [
    {
      id: 'muddy-bit',
      label: 'MUDDY BIT',
      hook: 'a vague arcade feed trend',
      rationale: 'safe but plain readable arcade gag',
      palette: ['#222222', '#333333'],
      modeFit: {
        platformer: 'small enemy theme',
        shooter: 'small ship theme',
        runner: 'small block theme',
        brick: 'small wall theme',
      },
      spriteDirection: 'generic tiny shapes',
      musicDirection: 'slow loop',
    },
    {
      id: 'six-seven-signal',
      label: 'SIX SEVEN SIGNAL',
      hook: 'SIX SEVEN hand wave arcade brainrot',
      rationale: 'safe absurd trend with strong readable motion',
      palette: ['#3ef0ff', '#ff3ea5', '#ffe14d'],
      modeFit: {
        platformer: 'hand wave enemy silhouettes',
        shooter: 'up down ship silhouettes',
        runner: 'gesture obstacle blocks',
        brick: 'six seven brick wall markings',
      },
      spriteDirection: 'sprite silhouettes for enemy obstacle projectile and brick',
      musicDirection: '167 bpm synth bass drum arcade loop',
    },
    {
      id: 'flat-chat',
      label: 'FLAT CHAT',
      hook: 'comment feed scroll gag',
      rationale: 'safe readable but less visual',
      palette: ['#999999', '#aaaaaa'],
      modeFit: {
        platformer: 'chat enemy theme',
        shooter: 'chat ship theme',
        runner: 'chat obstacle theme',
        brick: 'chat wall theme',
      },
      spriteDirection: 'label themed shapes',
      musicDirection: 'arcade loop',
    },
  ],
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

{
  const seen = new Set<string>()
  for (const id of ADULT_MEME_THEME_IDS) {
    if (!/^[a-z0-9-]+$/.test(id)) fail(`adult theme id ${id} is not URL-safe`)
    if (seen.has(id)) fail(`duplicate adult theme id ${id}`)
    seen.add(id)
  }
  if (seen.size !== ADULT_MEME_THEMES.length) fail('adult theme id export drifted')
  for (const id of seen) {
    if (OFFLINE_MEME_THEME_IDS.includes(id)) fail(`adult theme id ${id} collides with safe catalog`)
  }
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

for (const t of ADULT_MEME_THEMES) {
  const theme = normaliseMemeTheme(t, '2026-08-27', MEME_THEME_SOURCE.Offline)
  if (!theme) {
    fail(`adult theme ${t.id} does not validate`)
  } else if (!theme.spritePack) {
    fail(`adult theme ${t.id} has no sprite pack`)
  } else if (!theme.musicPlan) {
    fail(`adult theme ${t.id} has no music plan`)
  }
}

{
  const safeSpritePacks = new Set(OFFLINE_MEME_THEMES.map((t) => t.spritePack))
  const requiredAdultIds = [
    'bunker-posting',
    'debate-afterparty',
    'tabloid-island',
    'strongman-feed',
    'maga-rally',
    'kirk-mode',
  ] as const
  for (const id of requiredAdultIds) {
    const theme = adultMemeThemeById(id, '2026-08-27')
    if (!theme?.spritePack) {
      fail(`adult theme ${id} is missing or has no sprite pack`)
      continue
    }
    if (safeSpritePacks.has(theme.spritePack)) fail(`adult theme ${id} reuses a safe sprite pack object`)
    for (const role of ALL_MEME_SPRITE_ROLES) {
      if (!theme.spritePack[role]) fail(`adult theme ${id} is missing ${role}`)
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
  const bunker = adultMemeThemeById('bunker-posting', '2026-08-27')
  if (!bunker || bunker.label !== 'BUNKER POSTING' || !bunker.spritePack || !bunker.musicPlan) {
    fail('adultMemeThemeById did not return a valid adult theme')
  }
  const tabloid = adultMemeThemeById('tabloid-island', '2026-08-27')
  if (!tabloid || tabloid.label !== 'TABLOID ISLAND' || !tabloid.spritePack || !tabloid.musicPlan) {
    fail('adultMemeThemeById did not return the tabloid island theme')
  }
  const maga = adultMemeThemeById('maga-rally', '2026-08-27')
  if (!maga || maga.label !== 'MAGA RALLY' || !maga.spritePack || !maga.musicPlan) {
    fail('adultMemeThemeById did not return the MAGA rally theme')
  }
  const kirk = adultMemeThemeById('kirk-mode', '2026-08-27')
  if (!kirk || kirk.label !== 'KIRK MODE' || !kirk.spritePack || !kirk.musicPlan) {
    fail('adultMemeThemeById did not return the Kirk mode theme')
  }
  const magaText = [
    ...(maga?.shiftLines ?? []),
    ...(maga?.taunts ?? []),
    ...Object.values(maga?.modeFlavor ?? {}).flatMap((flavor) => Object.values(flavor)),
  ].join(' ')
  for (const label of ['CHINA', 'FAKE NEWS', 'QUITE FRANKLY', 'MAGA']) {
    if (!magaText.includes(label)) fail(`MAGA rally is missing requested label ${label}`)
  }
  if (tabloid?.modeFlavor.shooter.enemy !== 'PRIVATE JET') fail('tabloid island shooter enemy is not a private jet')
  if (tabloid?.modeFlavor.runner.obstacle !== 'CASE FILE') fail('tabloid island runner obstacle is not a case file')
  if (kirk?.musicPlan.style !== 'anthem lament') fail('kirk mode did not use the rewritten anthem lament preset')
  if (kirk?.musicPlan.bpm !== 90) fail('kirk mode did not use the MIDI-derived tempo')
  if (kirk?.musicPlan.scale !== 'minor') fail('kirk mode did not use the chord-sheet minor scale')
  if (kirk?.musicPlan.drumKit !== 'march') fail('kirk mode did not use the restrained march drum kit')
  if (kirk?.musicPlan.bassWave !== 'triangle' || kirk.musicPlan.leadWave !== 'square') {
    fail('kirk mode did not use the MP3-inspired bass and lead shape')
  }
  if (!kirk?.musicPlan.chordPattern || !kirk.musicPlan.padPattern) fail('kirk mode did not include harmony layers')
  const kirkStyles = new Set(kirk?.musicPlans?.map((plan) => plan.style) ?? [])
  for (const style of ['anthem lament', 'anthem rise', 'anthem bridge']) {
    if (!kirkStyles.has(style)) fail(`kirk mode is missing music variant ${style}`)
  }
  const expectedKirkRoots = [0, -1, 3, -1, 6, -1, 2, -1, 4, -1, 0, -1, 5, -1, 4, 0]
  if (kirk?.musicPlan.chordPattern?.join(',') !== expectedKirkRoots.join(',')) {
    fail('kirk mode did not use the chord-sheet-inspired root progression')
  }
  const kirkRuntimeText = [
    ...(kirk?.shiftLines ?? []),
    ...(kirk?.taunts ?? []),
    kirk?.musicPlan.style ?? '',
    ...Object.values(kirk?.modeFlavor ?? {}).flatMap((flavor) => Object.values(flavor)),
  ].join(' ')
  if (/we are charlie kirk|carry the flame|honor his name|heaven known|battle is raging|cross is our guide/i.test(kirkRuntimeText)) {
    fail('kirk mode includes copied song text')
  }
  if (adultMemeThemeById('war-room-absurd', '2026-08-27') !== null) {
    fail('removed war-room-absurd adult theme is still selectable')
  }
  if (ADULT_MEME_THEME_IDS.includes('war-room-absurd')) {
    fail('removed war-room-absurd adult theme is still exported')
  }
  if (adultMemeThemeById('six-seven', '2026-08-27') !== null) {
    fail('adultMemeThemeById accepted a safe catalog id')
  }
  if (!normaliseMemeTheme(adultMemeThemeForDate('2026-08-27'), '2026-08-27', MEME_THEME_SOURCE.Offline)) {
    fail('adultMemeThemeForDate did not produce a valid theme')
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
  ['bad wave', { ...validDraft, musicPlan: { ...validDraft.musicPlan, leadWave: 'organ' } }],
  ['bad drum kit', { ...validDraft, musicPlan: { ...validDraft.musicPlan, drumKit: 'stadium' } }],
  ['bad swing', { ...validDraft, musicPlan: { ...validDraft.musicPlan, swing: 2 } }],
  ['bad chord pattern', { ...validDraft, musicPlan: { ...validDraft.musicPlan, chordPattern: [0, 8] } }],
  ['bad music plans', { ...validDraft, musicPlans: [{ ...validDraft.musicPlan }, { ...validDraft.musicPlan, bpm: 1000 }] }],
  ['too many music plans', { ...validDraft, musicPlans: Array.from({ length: 5 }, () => validDraft.musicPlan) }],
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
  const styles = new Set<string>()
  for (const t of [...OFFLINE_MEME_THEMES, ...ADULT_MEME_THEMES]) {
    if (!t.musicPlans || t.musicPlans.length < 2) fail(`${t.id} does not expose multiple music plans`)
    for (const plan of t.musicPlans ?? [t.musicPlan]) styles.add(plan.style)
  }
  for (const style of [
    'rally stomp',
    'island noir',
    'border wall bounce',
    'debate club',
    'war room pulse',
    'arcade lounge',
    'anthem lament',
    'anthem rise',
    'anthem bridge',
  ]) {
    if (!styles.has(style)) fail(`new music style "${style}" is not bundled`)
  }

  const first = offlineMemeThemeById('six-seven', '2026-08-27')
  const later = offlineMemeThemeById('six-seven', '2026-08-28')
  if (!first?.musicPlan || !later?.musicPlan) fail('music plan selection returned no plan')
}

{
  const theme = await fetchLiveMemeTheme('2026-08-27', async () => response(200, validDraft))
  if (!theme || theme.source !== MEME_THEME_SOURCE.Live || theme.date !== '2026-08-27' || !theme.spritePack || !theme.musicPlan) {
    fail('valid live response was not accepted')
  }
}

{
  const theme = normaliseMemeTheme(validModeThemeDraft, '2026-08-27', MEME_THEME_SOURCE.Live)
  if (!theme?.modeThemes?.runner) fail('valid modeThemes draft was rejected')
  const runner = theme ? themeForMode(theme, 'runner') : null
  const shooter = theme ? themeForMode(theme, 'shooter') : null
  if (runner?.label !== 'RUNNER FEED') fail('themeForMode did not apply runner label override')
  if (runner?.modeFlavor.runner.obstacle !== 'RUN CLIP') fail('themeForMode did not apply runner flavor override')
  if (runner?.spritePack?.runnerObstacle.join('\n') !== OFFLINE_MEME_THEMES[1].spritePack!.runnerObstacle.join('\n')) {
    fail('themeForMode did not apply runner sprite override')
  }
  if (shooter?.label === 'RUNNER FEED') fail('themeForMode leaked runner label into shooter')
  if (normaliseMemeTheme({ ...validDraft, modeThemes: { runner: { label: '<b>bad</b>' } } }, '2026-08-27', MEME_THEME_SOURCE.Live)) {
    fail('malformed modeThemes override was accepted')
  }
}

{
  const safeBundle = themeBundleForDate('2026-08-27')
  const adultBundle = themeBundleForDate('2026-08-27', true)
  const modes: readonly GameMode[] = ['platformer', 'shooter', 'runner', 'brick']
  const safeIds = new Set(modes.map((m) => themeForMode(safeBundle, m, 0).id))
  const adultIds = new Set(modes.map((m) => themeForMode(adultBundle, m, 0).id))
  const platformer0 = themeForMode(safeBundle, 'platformer', 0)
  const platformer1 = themeForMode(safeBundle, 'platformer', 1)
  const platformerAgain = themeForMode(safeBundle, 'platformer', 1)
  if ((safeBundle.themeRotations?.platformer.length ?? 0) < 3) fail('offline safe rotations did not include at least three platformer themes')
  if ((adultBundle.themeRotations?.runner.length ?? 0) < 3) fail('offline adult rotations did not include at least three runner themes')
  if (safeIds.size < 3) fail('offline safe rotations lined up too many modes on the same theme')
  if (adultIds.size < 3) fail('offline adult rotations lined up too many modes on the same theme')
  if (platformer0.id === platformer1.id) fail('offline same-mode theme did not rotate across shifts')
  if (platformer1.id !== platformerAgain.id) fail('offline same-mode theme rotation was not deterministic')
  if ([...safeIds].some((id) => !OFFLINE_MEME_THEME_IDS.includes(id))) {
    fail('offline safe bundle selected a non-safe theme')
  }
  if ([...adultIds].some((id) => !ADULT_MEME_THEME_IDS.includes(id))) {
    fail('offline adult bundle selected a non-adult theme')
  }
}

{
  const theme = normaliseMemeTheme(validRotationDraft, '2026-08-27', MEME_THEME_SOURCE.Live)
  if (!theme?.themeRotations) fail('valid live theme rotations were rejected')
  if (themeForMode(theme!, 'platformer', 0).id !== 'PLATFORMER-ONE') fail('rotation shift 0 did not select first platformer theme')
  if (themeForMode(theme!, 'platformer', 1).id !== 'PLATFORMER-TWO') fail('rotation shift 1 did not select second platformer theme')
  if (themeForMode(theme!, 'platformer', 4).id !== 'PLATFORMER-TWO') fail('rotation did not wrap deterministically')
  if (normaliseMemeTheme({
    ...validRotationDraft,
    themeRotations: { ...validRotationDraft.themeRotations, brick: validRotationDraft.themeRotations.brick.slice(0, 2) },
  }, '2026-08-27', MEME_THEME_SOURCE.Live)) {
    fail('short live theme rotation was accepted')
  }
}

{
  const theme = normaliseMemeTheme(validBundleDraft, '2026-08-27', MEME_THEME_SOURCE.Live)
  if (!theme?.bundleThemes) fail('valid live theme bundle was rejected')
  if (themeForMode(theme!, 'platformer').id !== 'BUNDLE-PLATFORMER') fail('bundle platformer theme was not selected')
  if (themeForMode(theme!, 'brick').label !== 'BUNDLE BRICK') fail('bundle brick theme was not selected')
  if (normaliseMemeTheme({
    ...validBundleDraft,
    modeThemeBundle: { ...validBundleDraft.modeThemeBundle, brick: undefined },
  }, '2026-08-27', MEME_THEME_SOURCE.Live)) {
    fail('incomplete live theme bundle was accepted')
  }
  if (normaliseMemeTheme({
    ...validBundleDraft,
    modeThemeBundle: {
      ...validBundleDraft.modeThemeBundle,
      brick: { ...validDraft, id: 'bundle-runner', label: 'DUPLICATE' },
    },
  }, '2026-08-27', MEME_THEME_SOURCE.Live)) {
    fail('duplicate live theme bundle ids were accepted')
  }
}

{
  const theme = normaliseMemeTheme(validDraft, '2026-08-27', MEME_THEME_SOURCE.Live)
  const platformer = theme ? themeForMode(theme, 'platformer') : null
  const shooter = theme ? themeForMode(theme, 'shooter') : null
  const runner = theme ? themeForMode(theme, 'runner') : null
  const brick = theme ? themeForMode(theme, 'brick') : null
  const labels = new Set([platformer?.label, shooter?.label, runner?.label, brick?.label])
  if (labels.size !== 4) fail('global-only theme did not synthesize distinct per-mode labels')
  if (platformer?.variantId !== 'platformer' || brick?.variantId !== 'brick') {
    fail('global-only theme did not synthesize per-mode variant ids')
  }
  if (platformer?.palette[0] === shooter?.palette[0] && platformer?.palette[0] === runner?.palette[0]) {
    fail('global-only theme did not rotate per-mode palette accents')
  }
  if (!runner?.shiftLines[0].includes('OVERDRIVE')) {
    fail('global-only runner variant did not add a mode-specific shift line')
  }
}

{
  const candidates = normaliseCandidateConcepts(validCandidates)
  if (!candidates || candidates.length !== 3) fail('valid candidate concepts were rejected')
  const best = chooseBestCandidate(validCandidates)
  if (best?.id !== 'six-seven-signal') fail('candidate scoring did not prefer the strongest game-fit concept')
  if (candidates && scoreCandidateConcept(candidates[1]) <= scoreCandidateConcept(candidates[0])) {
    fail('specific readable meme candidate did not outscore generic candidate')
  }
  if (normaliseCandidateConcepts({ candidates: [validCandidates.candidates[0]] })) {
    fail('candidate parser accepted the wrong number of concepts')
  }
  if (
    normaliseCandidateConcepts({
      candidates: [
        validCandidates.candidates[0],
        { ...validCandidates.candidates[1], hook: '<b>bad</b>' },
        validCandidates.candidates[2],
      ],
    })
  ) {
    fail('candidate parser accepted markup')
  }
}

{
  const safeReview = normaliseMemeReview({
    rating: 'edgy-but-safe',
    reason: 'chaotic but safe',
    checks: {
      noSlurs: true,
      noProtectedClassAttack: true,
      noExplicitSexualContent: true,
      noGore: true,
      noUrlsOrMarkup: true,
      noCopyrightedMusicReference: true,
      noPersonalHarassment: true,
    },
  })
  if (safeReview?.rating !== 'edgy-but-safe') fail('edgy-but-safe review was rejected')
  const rejected = normaliseMemeReview({
    rating: 'safe',
    reason: 'missed a check',
    checks: {
      noSlurs: true,
      noProtectedClassAttack: true,
      noExplicitSexualContent: false,
      noGore: true,
      noUrlsOrMarkup: true,
      noCopyrightedMusicReference: true,
      noPersonalHarassment: true,
    },
  })
  if (rejected?.rating !== 'reject') fail('failed review checklist did not reject')
}

{
  let sentBody = ''
  const theme = await fetchLiveMemeTheme(
    '2026-08-27',
    async (_input, init) => {
      sentBody = init.body ?? ''
      return response(200, validDraft)
    },
    {
      currentMode: 'runner',
      weakestMode: 'brick',
      strongestMode: 'shooter',
      damageTaken: 12,
      accuracyPct: 50,
      jumps: 9,
      pickups: 2,
      healthPct: 80,
      currentModeStress: 'medium',
      cleanStageStreak: 2,
      recentDeaths: 0,
      recentShiftCount: 3,
      recentChaosFlags: ['mirrorWorld'],
    },
  )
  if (!theme || theme.source !== MEME_THEME_SOURCE.Live) fail('telemetry live fetch was not accepted')
  if (!sentBody.includes('"telemetry"') || !sentBody.includes('"currentMode":"runner"')) {
    fail('telemetry live fetch did not POST the compact summary')
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
  if (!theme.themeRotations) fail(`${name} did not fall back to per-shift theme rotations`)
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
  if (theme.bundleThemes) fail('forced offline meme id unexpectedly enabled cycling')
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

{
  let calls = 0
  const theme = await loadDailyMemeTheme(
    '2026-08-27',
    async () => {
      calls++
      return response(200, validDraft)
    },
    memoryStorage(),
    'debate-afterparty',
    true,
  )
  if (theme.id !== 'debate-afterparty' || theme.source !== MEME_THEME_SOURCE.Offline) {
    fail('adult forced meme id did not select adult catalog')
  }
  if (theme.bundleThemes) fail('adult forced meme id unexpectedly enabled cycling')
  if (calls !== 0) fail('adult meme mode called live fetch')
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
    true,
  )
  if (!ADULT_MEME_THEME_IDS.includes(theme.id)) fail('adult mode invalid forced id did not use adult fallback')
  if (!theme.themeRotations) fail('adult mode invalid forced id did not fall back to cycling rotations')
  if (calls !== 0) fail('adult fallback called live fetch')
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('  OK  daily meme themes validate and fall back offline')
