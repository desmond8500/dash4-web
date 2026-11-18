import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import { emailsToRows, phonesToRows, rowErrors, rowsToEmails, rowsToPhones, telHref } from '../src/utils/contactLists'
import { statusSeverity } from '../src/utils/clients'

describe('menu des clients', () => {
  const menuFor = (permissions: string[]) =>
    visibleMenu((wanted) => wanted.some((p) => permissions.includes(p))).map((e) => e.to)

  it('montre Clients et Contacts avec clients.view ou clients.view.own', () => {
    expect(menuFor(['clients.view'])).toEqual(['/clients', '/contacts'])
    expect(menuFor(['clients.view.own'])).toEqual(['/clients', '/contacts'])
  })

  it('les cache sans droit sur les clients', () => {
    expect(menuFor(['users.view'])).toEqual(['/utilisateurs'])
  })
})

describe('téléphones et e-mails du formulaire', () => {
  it('retire les lignes vides et les espaces avant l\'envoi', () => {
    const rows = [
      { label: ' Bureau ', value: ' 33 800 00 00 ' },
      { label: 'Mobile', value: '   ' },
      { label: '', value: '77 000 00 00' },
    ]
    expect(rowsToPhones(rows)).toEqual([
      { label: 'Bureau', number: '33 800 00 00' },
      { label: null, number: '77 000 00 00' },
    ])
    expect(rowsToEmails([{ label: '', value: 'a@b.sn' }])).toEqual([{ label: null, address: 'a@b.sn' }])
  })

  it('transforme les listes de l\'API en lignes éditables', () => {
    expect(phonesToRows([{ id: 1, label: null, number: '77' }])).toEqual([{ label: '', value: '77' }])
    expect(emailsToRows(undefined)).toEqual([])
  })

  it('place chaque erreur de l\'API sous la bonne ligne', () => {
    const errors = {
      'phones.1.number': ['Le champ numéro est obligatoire.'],
      'emails.0.address': ['Adresse invalide.'],
      name: ['Le champ nom est obligatoire.'],
    }
    expect(rowErrors(errors, 'phones')).toEqual({ 1: 'Le champ numéro est obligatoire.' })
    expect(rowErrors(errors, 'emails')).toEqual({ 0: 'Adresse invalide.' })
  })

  it('crée un lien d\'appel sans espaces', () => {
    expect(telHref('+221 77 000 00 00')).toBe('tel:+221770000000')
  })
})

describe('statut des clients', () => {
  it('colore les clients actifs, prospects et inactifs', () => {
    expect(statusSeverity('active')).toBe('success')
    expect(statusSeverity('prospect')).toBe('info')
    expect(statusSeverity('inactive')).toBe('secondary')
  })
})
