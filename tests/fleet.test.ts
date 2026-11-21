import { describe, expect, it } from 'vitest'
import { alertLevel, intOrNull, vehicleIcon } from '../src/utils/fleet'
import { visibleMenu } from '../src/menu'

describe('parc automobile', () => {
  it('choisit une icône par type', () => {
    expect(vehicleIcon('scooter')).toBe('pi pi-bolt')
    expect(vehicleIcon('utility')).toBe('pi pi-truck')
    expect(vehicleIcon('car')).toBe('pi pi-car')
  })

  it('classe les alertes', () => {
    expect(alertLevel({ alerts: [] })).toBe(0)
    expect(alertLevel({ alerts: [{ kind: 'paper', state: 'soon', label: 'Assurance', date: null }] })).toBe(1)
    expect(alertLevel({ alerts: [{ kind: 'paper', state: 'soon', label: 'A', date: null }, { kind: 'maintenance', state: 'late', label: 'B', date: null }] })).toBe(2)
    expect(intOrNull(null)).toBeNull()
    expect(intOrNull(12.6)).toBe(13)
  })

  it('montre le parc à qui voit les véhicules, ou seulement les siens', () => {
    expect(visibleMenu((p) => p.includes('vehicles.view.own')).map((e) => e.label)).toContain('Parc automobile')
    expect(visibleMenu((p) => p.includes('stock.view')).map((e) => e.label)).not.toContain('Parc automobile')
  })
})
