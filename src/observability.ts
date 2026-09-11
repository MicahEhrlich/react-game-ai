import * as Sentry from '@sentry/react'

interface ObservabilityEnv {
  readonly DEV?: boolean
  readonly MODE?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_RELEASE?: string
  readonly VERCEL_GIT_COMMIT_SHA?: string
}

const REDACTED = '[Filtered]'

export function releaseFromEnv(env: ObservabilityEnv): string {
  return env.VITE_RELEASE?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || 'development'
}

export function scrubSentryEvent<T extends Sentry.Event>(event: T): T {
  delete event.user
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    event.request.url = event.request.url?.split('?')[0]
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|x-forwarded-for|x-real-ip)$/i.test(key)) {
          event.request.headers[key] = REDACTED
        }
      }
    }
  }
  delete event.contexts?.gameplay
  return event
}

function scrubSpan<T extends { description?: string; data: Record<string, unknown> }>(span: T): T {
  if (span.description?.includes('?')) span.description = span.description.split('?')[0]
  for (const key of Object.keys(span.data)) {
    if (/(query|body|cookie|authorization|user|client\.address|request\.header)/i.test(key)) delete span.data[key]
    else if (/url/i.test(key) && typeof span.data[key] === 'string') span.data[key] = span.data[key].split('?')[0]
  }
  return span
}

const env = (import.meta as ImportMeta & { readonly env?: ObservabilityEnv }).env ?? {}

export const RELEASE = releaseFromEnv(env)

export function initObservability(): boolean {
  const dsn = env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return false
  Sentry.init({
    dsn,
    enabled: true,
    environment: env.MODE,
    release: RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: env.DEV ? 0 : 0.1,
    beforeSend: scrubSentryEvent,
    beforeSendSpan: scrubSpan,
  })
  Sentry.setTag('runtime', 'client')
  return true
}

function routeName(input: string | URL | Request): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  try {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin ?? 'http://localhost'
    return new URL(raw, origin).pathname
  } catch {
    return 'unknown'
  }
}

export async function observedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const route = routeName(input)
  const method = init?.method?.toUpperCase() ?? (input instanceof Request ? input.method : 'GET')
  return Sentry.startSpan({ name: `${method} ${route}`, op: 'http.client', attributes: { 'http.route': route, 'http.request.method': method } }, async (span) => {
    try {
      const response = await fetch(input, init)
      span.setAttribute('http.response.status_code', response.status)
      if (response.status >= 400) {
        Sentry.captureException(new Error(`API request failed: ${method} ${route} (${response.status})`), {
          tags: { route, method, status: String(response.status) },
        })
      }
      return response
    } catch (error) {
      Sentry.captureException(new Error(`API request failed: ${method} ${route}`, { cause: error }), {
        tags: { route, method, status: 'network_error' },
      })
      throw error
    }
  })
}

export { Sentry }
