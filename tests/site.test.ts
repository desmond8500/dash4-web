import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import { equipmentForm, equipmentPayload, progressColor, reservesSummary } from '../src/utils/site'

describe('suivi de chantier', () => {
  it('prépare un équipement : champs vides à null, caractéristiques sans libellé retirées', () => {
    const f = { ...equipmentForm(null, 4), name: ' NVR ', quantity: 0, room_id: 9, level_id: 2, characteristics: [{ label: 'IP', value: ' 10.0.0.2 ' }, { label: ' ', value: 'x' }] }
    expect(equipmentPayload(f)).toMatchObject({ name: 'NVR', type: null, quantity: 1, parent_id: 4, room_id: 9, level_id: null, characteristics: [{ label: 'IP', value: '10.0.0.2' }] })
  })

  it('résume les réserves et colore l\'avancement', () => {
    expect(reservesSummary([])).toBe('Aucune réserve')
    expect(reservesSummary([{ text: 'a', lifted_at: '2026-11-19' }, { text: 'b', lifted_at: null }])).toBe('2 réserves, 1 levée')
    expect(progressColor(100)).toContain('green')
    expect(progressColor(10)).toContain('orange')
  })

  it('n\'ajoute pas d\'entrée de menu (le chantier est un onglet du projet)', () => {
    expect(visibleMenu(() => true).some((e) => e.label === 'Chantier')).toBe(false)
  })
})
