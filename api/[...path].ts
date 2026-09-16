import { createServiceJwt, serviceJwtSignerConfig } from '../server/serviceJwt.ts'

const ALLOWED_PATHS = new Set(['/api/scores', '/api/director', '/api/meme-theme'])
const RESPONSE_HEADERS = ['content-type', 'cache-control', 'retry-after'] as const

function configurationError(): Response {
  return Response.json({ error: 'service unavailable' }, { status: 503 })
}

export default async function handler(request: Request): Promise<Response> {
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
