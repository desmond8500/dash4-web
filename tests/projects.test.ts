import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import {
  documentError,
  fileIcon,
  fileSize,
  formatDate,
  fromApiDate,
  mapsUrl,
  normalizeUrl,
  periodLabel,
  projectStatusSeverity,
  toApiDate,
} from '../src/utils/projects'

describe('projets', () => {
  it('affiche la période du projet', () => {
    expect(formatDate('2026-12-01')).toBe('01/12/2026')
    expect(periodLabel('2026-12-01', '2027-01-15')).toBe('du 01/12/2026 au 15/01/2027')
    expect(periodLabel('2026-12-01', null)).toBe('à partir du 01/12/2026')
    expect(periodLabel(null, '2027-01-15')).toBe("jusqu'au 15/01/2027")
    expect(periodLabel(null, null)).toBe('')
  })

  it('envoie les dates du calendrier sans décalage de fuseau', () => {
    expect(toApiDate(new Date(2026, 11, 1))).toBe('2026-12-01')
    expect(toApiDate(null)).toBeNull()
    expect(fromApiDate('2026-12-01')?.getDate()).toBe(1)
  })

  it('ouvre la carte sur le GPS, sinon sur l\'adresse', () => {
    expect(mapsUrl(14.67, -17.43, 'Dakar')).toBe('https://www.google.com/maps/search/?api=1&query=14.67,-17.43')
    expect(mapsUrl(null, null, 'Dakar Plateau')).toBe('https://www.google.com/maps/search/?api=1&query=Dakar%20Plateau')
    expect(mapsUrl(null, null, null)).toBeNull()
  })

  it('colore les statuts', () => {
    expect(projectStatusSeverity('in_progress')).toBe('info')
    expect(projectStatusSeverity('completed')).toBe('success')
    expect(projectStatusSeverity('cancelled')).toBe('danger')
  })

  it('montre le menu Projets avec projects.view ou projects.view.own', () => {
    const menuFor = (permissions: string[]) =>
      visibleMenu((wanted) => wanted.some((p) => permissions.includes(p))).map((e) => e.to)
    expect(menuFor(['projects.view.own'])).toContain('/projets')
    expect(menuFor(['clients.view'])).not.toContain('/projets')
  })
})

describe('documents et liens', () => {
  it('refuse avant l\'envoi les formats dangereux et les fichiers trop lourds', () => {
    expect(documentError({ name: 'plan.PDF', size: 1000 })).toBeNull()
    expect(documentError({ name: 'plan.dwg', size: 1000 })).toBeNull()
    expect(documentError({ name: 'virus.exe', size: 10 })).toBe('Format non accepté (exe).')
    expect(documentError({ name: 'page.html', size: 10 })).toBe('Format non accepté (html).')
    expect(documentError({ name: 'gros.pdf', size: 21 * 1024 * 1024 })).toBe('Le fichier dépasse 20 Mo.')
  })

  it('affiche la taille et l\'icône des fichiers', () => {
    expect(fileSize(850)).toBe('850 o')
    expect(fileSize(12 * 1024)).toBe('12 Ko')
    expect(fileSize(3.4 * 1024 * 1024)).toBe('3,4 Mo')
    expect(fileIcon('devis.pdf')).toBe('pi pi-file-pdf')
    expect(fileIcon('photo.JPG')).toBe('pi pi-image')
  })

  it('complète une adresse web sans https://', () => {
    expect(normalizeUrl(' drive.google.com/x ')).toBe('https://drive.google.com/x')
    expect(normalizeUrl('http://intranet.local')).toBe('http://intranet.local')
  })
})
