import { describe, expect, it } from 'vitest'
import { initObservability, releaseFromEnv, scrubSentryEvent } from './observability.ts'

describe('observability privacy and releases', () => {
  it('stays disabled when no DSN is configured', () => {
    expect(initObservability()).toBe(false)
  })
  it('chooses an explicit release, then the deployment commit', () => {
    expect(releaseFromEnv({ VITE_RELEASE: ' release-1 ', VERCEL_GIT_COMMIT_SHA: 'sha' })).toBe('release-1')
    expect(releaseFromEnv({ VERCEL_GIT_COMMIT_SHA: ' sha ' })).toBe('sha')
    expect(releaseFromEnv({})).toBe('development')
  })

  it('removes identifying request and gameplay data', () => {
    const event = scrubSentryEvent({
      user: { id: 'player' },
      request: {
        url: 'https://example.test/api/scores?name=PLAYER',
        data: { name: 'PLAYER', score: 10 },
        cookies: { session: 'secret' },
        query_string: 'name=PLAYER',
        headers: { authorization: 'secret', cookie: 'session=secret', accept: 'application/json' },
      },
      contexts: { gameplay: { score: 10 } },
    })
    expect(event.user).toBeUndefined()
    expect(event.request?.url).toBe('https://example.test/api/scores')
    expect(event.request?.data).toBeUndefined()
    expect(event.request?.query_string).toBeUndefined()
    expect(event.request?.headers?.authorization).toBe('[Filtered]')
    expect(event.contexts?.gameplay).toBeUndefined()
  })
})
