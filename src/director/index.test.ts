import { describe, expect, it } from 'vitest'
import { makeDirector } from './index.ts'
import { isLiveDirector } from './types.ts'

describe('director factory', () => {
  it('returns heuristic-only director when AI Mode is off', () => {
    expect(isLiveDirector(makeDirector(false))).toBe(false)
  })
})
