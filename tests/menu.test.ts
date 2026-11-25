import { describe, expect, it } from 'vitest'
import { MENU, MENU_GROUPS, activeEntry, menuTree, visibleMenu } from '../src/menu'

const tree = (permissions: string[]) => menuTree(visibleMenu((wanted) => wanted.some((p) => permissions.includes(p))))
const shape = (permissions: string[]) =>
  tree(permissions).map((n) => (n.kind === 'link' ? n.entry.label : `${n.group.label} › ${n.entries.map((e) => e.label).join(', ')}`))

describe('menus et sous-menus', () => {
  it('range chaque entrée dans un menu connu, et chaque menu a des entrées', () => {
    const keys = MENU_GROUPS.map((g) => g.key)
    expect(MENU.filter((e) => e.group && !keys.includes(e.group))).toEqual([])
    expect(MENU_GROUPS.filter((g) => !MENU.some((e) => e.group === g.key))).toEqual([])
    expect(new Set(MENU.map((e) => e.to)).size).toBe(MENU.length)
  })

  it('garde les liens directs en haut, puis les menus dans leur ordre', () => {
    expect(shape(['dashboard.view', 'clients.view', 'client_requests.view', 'stock.view', 'purchases.view'])).toEqual([
      'Tableau de bord',
      'Messages',
      'Clients › Clients, Contacts, Demandes',
      'Stock et achats › Articles, Mouvements, Emplacements, Achats, Fournisseurs et marques, Icônes des plans',
      'Outils pratiques',
    ])
  })

  it('montre un menu à une seule entrée comme un lien direct, et cache un menu vide', () => {
    // Sans autre droit : « Outils pratiques » seul dans « Matériel » → lien direct, pas de menu
    expect(shape([])).toEqual(['Messages', 'Outils pratiques'])
    expect(shape(['vehicles.view.own'])).toEqual(['Messages', 'Matériel › Parc automobile, Outils pratiques'])
  })

  it('trouve l\'entrée de la page ouverte, la plus précise', () => {
    const entries = visibleMenu(() => true)
    expect(activeEntry(entries, '/')?.label).toBe('Tableau de bord')
    expect(activeEntry(entries, '/stock')?.label).toBe('Articles')
    expect(activeEntry(entries, '/stock/articles/5')?.label).toBe('Articles')
    expect(activeEntry(entries, '/stock/outillage/2')?.label).toBe('Outillage')
    expect(activeEntry(entries, '/devis/modeles')?.label).toBe('Modèles de devis')
    expect(activeEntry(entries, '/devis/12')?.label).toBe('Devis')
    expect(activeEntry(entries, '/profil')).toBeNull()
    expect(activeEntry(entries, '/devisxyz')).toBeNull()
  })
})
