import { describe, expect, it, vi } from 'vitest'

vi.mock('photoswipe', () => ({ default: vi.fn() }))
vi.mock('photoswipe/style.css', () => ({}))
vi.mock('@/services/api', () => ({ api: { documents: { download: vi.fn() } } }))

describe('visionneuse d\'images', () => {
  it('ne montre que les images', async () => {
    const { isImageDocument } = await import('../src/utils/lightbox')
    expect(isImageDocument({ mime_type: 'image/jpeg' })).toBe(true)
    expect(isImageDocument({ mime_type: 'application/pdf' })).toBe(false)
    expect(isImageDocument({ mime_type: null })).toBe(false)
  })
})
