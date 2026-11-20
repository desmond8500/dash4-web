import { describe, expect, it } from 'vitest'
import { initials, nextCvName } from '../src/utils/cv'

describe('espace personnel', () => {
  it('propose un nom de CV libre', () => {
    expect(nextCvName([])).toBe('CV')
    expect(nextCvName([{ name: 'CV' }])).toBe('CV 2')
    expect(nextCvName([{ name: 'cv' }, { name: 'CV 2' }])).toBe('CV 3')
  })

  it('calcule les initiales', () => {
    expect(initials('awa', ' Ndiaye')).toBe('AN')
  })
})
