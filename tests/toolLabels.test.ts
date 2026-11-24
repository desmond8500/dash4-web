import { describe, expect, it } from 'vitest'
import { toolLabelsHtml } from '../src/utils/toolLabels'

describe('étiquettes de l’outillage', () => {
  const tools = [
    { id: 7, name: 'Perceuse <Bosch>', code: 'OUT-007' },
    { id: 8, name: 'Escabeau', code: null },
  ]

  it('met un QR code, le nom (échappé) et le numéro de chaque outil', () => {
    const html = toolLabelsHtml(tools, { format: 'a4-24', origin: 'https://dash4.yonkou.info' })
    expect(html.match(/<svg /g)).toHaveLength(2)
    expect(html).toContain('Perceuse &lt;Bosch&gt;')
    expect(html).toContain('<div class="code">OUT-007</div>')
    expect(html).toContain('repeat(3, 70mm)')
  })

  it('laisse vides les premières étiquettes d’une planche entamée, sauf en rouleau', () => {
    expect(toolLabelsHtml(tools, { format: 'a4-65', origin: null, skip: 3 }).match(/label blank/g)).toHaveLength(3)
    expect(toolLabelsHtml(tools, { format: 'roll', origin: null, skip: 3 })).not.toContain('label blank')
  })
})
