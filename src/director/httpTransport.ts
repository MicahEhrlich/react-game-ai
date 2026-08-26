import type { DirectorRequest, DirectorTransport } from './LlmDirector.ts'

/**
 * Talks to the dev-only /api/director middleware (see server/).
 *
 * This is the ONLY file in src/director/ that touches fetch or import.meta,
 * which is what keeps LlmDirector importable by the node validator. It is
 * reached exclusively through director/index.ts.
 *
 * Every failure here is expected rather than exceptional: in a production
 * build the endpoint does not exist at all, and with no API key configured it
 * answers 204. Both simply mean "the heuristic decides".
 */
const ENDPOINT = '/api/director'

export class HttpDirectorTransport implements DirectorTransport {
  async request(payload: DirectorRequest, signal: AbortSignal): Promise<unknown> {
    const started = Date.now()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
      cache: 'no-store',
    })

    // 204 is the server's "nothing to say" -- no key, upstream refusal, or a
    // failed call. It is a success status, so it has to be caught before
    // res.ok waves it through into res.json(), which would throw on an empty
    // body and read as a transport fault rather than a normal quiet answer.
    if (res.status === 204) throw new Error('no plan offered')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    // A static host answers an unknown path with index.html -- a 200 carrying
    // HTML. Parsing that would surface as a bizarre model response instead of
    // the plain "there is no server here" that it actually is.
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('application/json')) {
      throw new Error(`unexpected content-type "${type}"`)
    }

    const body: unknown = await res.json()

    if (import.meta.env.DEV) {
      console.info(`[director] ${payload.kind} in ${Date.now() - started}ms`)
    }
    return body
  }
}
