import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServiceJwt, serviceJwtSignerConfig } from '../server/serviceJwt.js'

const ALLOWED_PATHS = new Set(['/api/scores', '/api/director', '/api/meme-theme'])
const RESPONSE_HEADERS = ['content-type', 'cache-control', 'retry-after'] as const

function configurationError(): Response {
  return Response.json({ error: 'service unavailable' }, { status: 503 })
}

export async function proxyRequest(request: Request): Promise<Response> {
  const incoming = new URL(request.url)
  if (!ALLOWED_PATHS.has(incoming.pathname)) return Response.json({ error: 'not found' }, { status: 404 })

  const base = (process.env.RENDER_API_BASE_URL ?? '').replace(/\/+$/, '')
  if (!base) return configurationError()

  try {
    const token = await createServiceJwt(serviceJwtSignerConfig(process.env))
    const headers = new Headers()
    for (const name of ['accept', 'content-type']) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('authorization', `Bearer ${token}`)
    const clientIp = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for')
    if (clientIp) headers.set('x-forwarded-for', clientIp.split(',')[0]!.trim())

    const upstream = await fetch(`${base}${incoming.pathname}${incoming.search}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
    })
    const responseHeaders = new Headers()
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return configurationError()
  }
}

async function requestBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const host = request.headers.host ?? 'localhost'
    const url = new URL(request.url ?? '/', `https://${host}`)
    const headers = new Headers()
    for (const [name, raw] of Object.entries(request.headers)) {
      if (Array.isArray(raw)) raw.forEach((value) => headers.append(name, value))
      else if (raw !== undefined) headers.set(name, raw)
    }
    const webRequest = new Request(url, {
      method: request.method,
      headers,
      body: await requestBody(request),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    const result = await proxyRequest(webRequest)
    response.statusCode = result.status
    result.headers.forEach((value, name) => response.setHeader(name, value))
    response.end(Buffer.from(await result.arrayBuffer()))
  } catch {
    response.statusCode = 503
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ error: 'service unavailable' }))
  }
}
