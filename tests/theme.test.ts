import { describe, expect, it, vi } from 'vitest'

describe('thème', () => {
  it('bascule entre clair et sombre', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { toggledTheme } = await import('../src/utils/theme')
    expect(toggledTheme('dark')).toBe('light')
    expect(toggledTheme('light')).toBe('dark')
    // « Comme l'appareil » avec un appareil en sombre : on passe en clair
    expect(toggledTheme('system')).toBe('light')
    vi.unstubAllGlobals()
  })
})
