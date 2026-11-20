import { describe, expect, it } from 'vitest'
import { daysSinceLast, fileSize } from '../src/utils/backups'

describe('sauvegardes', () => {
  it('affiche une taille lisible', () => {
    expect(fileSize(500)).toBe('500 o')
    expect(fileSize(1536)).toBe('1,5 Ko')
    expect(fileSize(5 * 1024 * 1024)).toBe('5 Mo')
  })

  it('compte les jours depuis la dernière sauvegarde de la base', () => {
    const now = new Date('2026-11-20T10:00:00Z')
    expect(daysSinceLast([], now)).toBeNull()
    expect(daysSinceLast([{ kind: 'files', created_at: '2026-11-19T02:30:00Z' }, { kind: 'database', created_at: '2026-11-17T02:30:00Z' }], now)).toBe(3)
  })
})
