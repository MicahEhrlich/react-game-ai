import { describe, expect, it } from 'vitest'
import { apiUrl } from './api.ts'

describe('API URL', () => {
  it('uses the same-origin API path by default', () => {
    expect(apiUrl('/api/scores')).toBe('/api/scores')
  })
})
