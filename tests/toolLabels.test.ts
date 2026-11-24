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

  it('prépare les rubans d’étiqueteuse de 24, 12 et 9 mm', () => {
    const t24 = toolLabelsHtml(tools, { format: 'tape-24', origin: 'https://dash4.yonkou.info', skip: 2 })
    expect(t24).toContain('size: 60mm 24mm')
    expect(t24).not.toContain('label blank')
    // Rubans étroits : QR code court (version 1, 21 modules + marge = 23)
    const t9 = toolLabelsHtml(tools, { format: 'tape-9', origin: 'https://dash4.yonkou.info' })
    expect(t9).toContain('size: 30mm 9mm')
    expect(t9.match(/viewBox="0 0 23 23"/g)).toHaveLength(2)
    expect(t9).toContain('<div class="code">Escabeau</div>')
    expect(toolLabelsHtml(tools, { format: 'tape-12', origin: null })).toContain('size: 40mm 12mm')
  })
})
