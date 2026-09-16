import { generateKeyPairSync } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { importSPKI, jwtVerify } from 'jose'
import handler, { proxyRequest } from './[...path].ts'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

function configure(): void {
  process.env.RENDER_API_BASE_URL = 'https://render.test/'
  process.env.SERVICE_JWT_PRIVATE_KEY = privateKey
  process.env.SERVICE_JWT_KEY_ID = 'proxy-test-key'
  process.env.SERVICE_JWT_ISSUER = 'https://frontend.test'
  process.env.SERVICE_JWT_AUDIENCE = 'react-game-ai-server'
}

afterEach(() => {
  vi.unstubAllGlobals()
  for (const key of ['RENDER_API_BASE_URL', 'SERVICE_JWT_PRIVATE_KEY', 'SERVICE_JWT_KEY_ID', 'SERVICE_JWT_ISSUER', 'SERVICE_JWT_AUDIENCE']) delete process.env[key]
})

describe('Vercel API proxy', () => {
  it('allowlists routes, signs a short-lived token, and forwards request and response data', async () => {
    configure()
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-hidden': 'no' },
    }))
    vi.stubGlobal('fetch', fetcher)

    const response = await proxyRequest(new Request('https://game.test/api/scores?limit=3', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.5' },
      body: JSON.stringify({ score: 10 }),
    }))

    expect(response.status).toBe(202)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('x-hidden')).toBeNull()
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://render.test/api/scores?limit=3')
    expect(init.method).toBe('POST')
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"score":10}')
    const headers = init.headers as Headers
    expect(headers.get('x-forwarded-for')).toBe('192.0.2.5')
    const token = headers.get('authorization')!.slice('Bearer '.length)
    const verified = await jwtVerify(token, await importSPKI(publicKey, 'RS256'), {
      algorithms: ['RS256'], issuer: 'https://frontend.test', audience: 'react-game-ai-server',
    })
    expect(verified.protectedHeader.kid).toBe('proxy-test-key')
    expect(verified.payload.jti).toBeTypeOf('string')
    expect(verified.payload.exp! - verified.payload.iat!).toBe(60)
  })

  it('rejects non-allowlisted routes without forwarding', async () => {
    configure()
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    expect((await proxyRequest(new Request('https://game.test/api/anything'))).status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fails safely when signing or upstream configuration is absent', async () => {
    expect((await proxyRequest(new Request('https://game.test/api/scores'))).status).toBe(503)
  })

  it('adapts Vercel Node request and response objects', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ entries: [] })))
    const request = Readable.from(['{"name":"ACE"}']) as IncomingMessage
    request.method = 'POST'
    request.url = '/api/scores?limit=1'
    request.headers = { host: 'game.test', 'content-type': 'application/json' }
    const headers = new Map<string, string | number | readonly string[]>()
    let body = Buffer.alloc(0)
    const response = {
      statusCode: 0,
      setHeader(name: string, value: string | number | readonly string[]) { headers.set(name, value); return this },
      end(chunk?: Uint8Array) { body = chunk ? Buffer.from(chunk) : Buffer.alloc(0); return this },
    } as unknown as ServerResponse

    await handler(request, response)

    expect(response.statusCode).toBe(200)
    expect(headers.get('content-type')).toContain('application/json')
    expect(JSON.parse(body.toString('utf8'))).toEqual({ entries: [] })
  })
})
