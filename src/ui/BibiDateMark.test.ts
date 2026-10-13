import { describe, expect, it } from 'vitest'
import { BibiDateMark } from './BibiDateMark.tsx'

describe('date mark in the mode-change overlay', () => {
  it('provides the 7.10 text alternative and the same two-color portrait graphic', () => {
    const element = BibiDateMark()
    expect(element.type).toBe('svg')
    expect(element.props.role).toBe('img')
    expect(element.props['aria-label']).toBe('7.10')
    expect(element.props.viewBox).toBe('0 0 48 20')
    expect(element.props.children.slice(0, 2).map((child: { props: { fill: string } }) => child.props.fill)).toEqual(['#000000', '#ffffff'])
    expect(element.props.children[2].type).toBe('image')
    expect(element.props.children[2].props.href).toContain('head-mono.png')
  })
})
