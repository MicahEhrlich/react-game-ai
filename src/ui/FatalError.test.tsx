import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FatalError } from './FatalError.tsx'

describe('FatalError', () => {
  it('offers an accessible recovery action', () => {
    const html = renderToStaticMarkup(<FatalError />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('THE ARCADE GLITCHED OUT')
    expect(html).toContain('REBOOT')
  })
})
