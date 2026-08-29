import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import { MEME_THEME_SOURCE, localDateKey, normaliseMemeTheme } from '../src/memeTheme/index.ts'
import { fetchTrendSeeds } from './trendSeeds.ts'

const MODEL = 'claude-opus-5'

const SYSTEM = `You write one safe cosmetic meme theme for THE GLITCH ENGINE.
Return strict JSON only. The theme is cosmetic: it never changes physics, damage, scoring, or difficulty.
Avoid URLs, markup, slurs, explicit content, harassment, and real-person attacks.
Use broad internet-culture flavor rather than copyrighted characters.
Keep every string short, punchy, and arcade-readable.
Also return a complete spritePack. Every sprite is exactly 16 strings of 16 characters.
Use only these pixel characters: . k d D W w m M c C r R o y g G b B f s
The dot is transparent. Make each role visually distinct and readable at tiny arcade scale.
Also return a musicPlan and optionally musicPlans for procedural WebAudio loops. Do not name real songs, artists, or samples.`

const FORMAT = {
  type: 'json_schema',
  name: 'meme_theme',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'label', 'palette', 'shiftLines', 'modeFlavor', 'spritePack', 'musicPlan', 'taunts'],
    properties: {
      id: { type: 'string' },
      label: { type: 'string' },
      palette: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string' },
      },
      shiftLines: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { type: 'string' },
      },
      taunts: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: { type: 'string' },
      },
      modeFlavor: {
        type: 'object',
        additionalProperties: false,
        required: ['platformer', 'shooter', 'runner', 'brick'],
        properties: {
          platformer: { $ref: '#/$defs/flavor' },
          shooter: { $ref: '#/$defs/flavor' },
          runner: { $ref: '#/$defs/flavor' },
          brick: { $ref: '#/$defs/flavor' },
        },
      },
      spritePack: {
        type: 'object',
        additionalProperties: false,
        required: [
          'platformerEnemy',
          'platformerHazard',
          'shooterEnemy',
          'shooterProjectile',
          'runnerObstacle',
          'brick',
          'brickCracked',
          'ball',
        ],
        properties: {
          platformerEnemy: { $ref: '#/$defs/sprite' },
          platformerHazard: { $ref: '#/$defs/sprite' },
          shooterEnemy: { $ref: '#/$defs/sprite' },
          shooterProjectile: { $ref: '#/$defs/sprite' },
          runnerObstacle: { $ref: '#/$defs/sprite' },
          brick: { $ref: '#/$defs/sprite' },
          brickCracked: { $ref: '#/$defs/sprite' },
          ball: { $ref: '#/$defs/sprite' },
        },
      },
      musicPlan: {
        $ref: '#/$defs/musicPlan',
      },
      musicPlans: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: { $ref: '#/$defs/musicPlan' },
      },
    },
    $defs: {
      flavor: {
        type: 'object',
        additionalProperties: false,
        required: ['enemy', 'obstacle', 'hazard', 'projectile', 'brick'],
        properties: {
          enemy: { type: 'string' },
          obstacle: { type: 'string' },
          hazard: { type: 'string' },
          projectile: { type: 'string' },
          brick: { type: 'string' },
        },
      },
      sprite: {
        type: 'array',
        minItems: 16,
        maxItems: 16,
        items: {
          type: 'string',
          minLength: 16,
          maxLength: 16,
        },
      },
      notes: {
        type: 'array',
        minItems: 1,
        maxItems: 16,
        items: { type: 'integer', minimum: -1, maximum: 7 },
      },
      drums: {
        type: 'array',
        minItems: 1,
        maxItems: 16,
        items: { type: 'integer', minimum: 0, maximum: 4 },
      },
      musicPlan: {
        type: 'object',
        additionalProperties: false,
        required: ['style', 'bpm', 'scale', 'bassPattern', 'leadPattern', 'drumPattern', 'intensity'],
        properties: {
          style: { type: 'string' },
          bpm: { type: 'integer', minimum: 90, maximum: 180 },
          scale: { enum: ['minor', 'major', 'pentatonic', 'chromatic'] },
          bassPattern: { $ref: '#/$defs/notes' },
          leadPattern: { $ref: '#/$defs/notes' },
          drumPattern: { $ref: '#/$defs/drums' },
          intensity: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const

type Handler = (
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  next: Connect.NextFunction,
) => void

function makeHandler(apiKey: string | undefined): Handler {
  let warned = false

  return (req, res, next) => {
    if (req.method !== 'GET') {
      next()
      return
    }

    const quiet = (): void => {
      res.statusCode = 204
      res.end()
    }

    void (async () => {
      if (!apiKey) {
        if (!warned) {
          warned = true
          console.info('[meme-theme] no ANTHROPIC_API_KEY -- bundled offline themes are in charge.')
        }
        quiet()
        return
      }

      const date = localDateKey()
      const started = Date.now()
      try {
        const trends = await fetchTrendSeeds()
        const { default: Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey })
        const message = await client.messages.create(
          {
            model: MODEL,
            max_tokens: 4096,
            system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
            messages: [
              {
                role: 'user',
                content:
                  `Today is ${date}. Create one once-daily cosmetic meme theme for an arcade game ` +
                  'with modes platformer, shooter, runner, and brick breaker. ' +
                  'Generate complete spritePack art for enemies, hazards, projectiles, runner obstacles, bricks, cracked bricks, and the ball. ' +
                  'Return one musicPlan, or up to four musicPlans, using only procedural synth descriptors and numeric patterns. ' +
                  `Use one or two of these safe trend seeds as inspiration: ${trends.map((t) => t.label).join(', ')}. ` +
                  'If using 67, spell it SIX SEVEN and treat it as absurd nonsensical brainrot.',
              },
            ],
            output_config: {
              effort: 'low',
              format: FORMAT,
            },
          },
          { timeout: 8000, maxRetries: 1 },
        )

        console.info(
          `[meme-theme] ${Date.now() - started}ms in=${message.usage.input_tokens} ` +
            `cache_read=${message.usage.cache_read_input_tokens ?? 0} out=${message.usage.output_tokens} ` +
            `stop=${message.stop_reason}`,
        )

        if (message.stop_reason === 'refusal') {
          quiet()
          return
        }

        const text = message.content
          .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
          .map((b) => b.text)
          .join('')
        const parsed = JSON.parse(text) as unknown
        const theme = normaliseMemeTheme(parsed, date, MEME_THEME_SOURCE.Live)
        if (!theme) {
          quiet()
          return
        }

        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(theme))
      } catch (err) {
        console.info(
          `[meme-theme] failed after ${Date.now() - started}ms: ` +
            (err instanceof Error ? err.message : 'unknown error'),
        )
        quiet()
      }
    })()
  }
}

export function memeThemeApi(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '')
  const handler = makeHandler(env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY)

  return {
    name: 'glitch-shift:meme-theme-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/meme-theme', handler)
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use('/api/meme-theme', handler)
    },
  }
}
