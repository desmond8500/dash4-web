import { describe, expect, it } from 'vitest'
import { liveMarkdownPreview, setLiveMarkdownPreview } from '../src/utils/markdownEditor'

describe('éditeur Markdown', () => {
  it('garde le réglage de l’aperçu en direct', () => {
    setLiveMarkdownPreview(true)
    expect(liveMarkdownPreview.value).toBe(true)
    setLiveMarkdownPreview(false)
    expect(liveMarkdownPreview.value).toBe(false)
  })
})
