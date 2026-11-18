/**
 * Menu principal. Un élément n'apparaît que si l'utilisateur a au moins une des permissions listées.
 * Les modules suivants (projets, devis…) seront ajoutés ici au fil des livraisons.
 */
export interface MenuEntry {
  label: string
  icon: string
  to: string
  permissions: string[]
}

export const MENU: MenuEntry[] = [
  { label: 'Tableau de bord', icon: 'pi pi-home', to: '/', permissions: ['dashboard.view', 'dashboard.view.own'] },
  { label: 'Clients', icon: 'pi pi-building', to: '/clients', permissions: ['clients.view', 'clients.view.own'] },
  { label: 'Contacts', icon: 'pi pi-address-book', to: '/contacts', permissions: ['clients.view', 'clients.view.own'] },
  { label: 'Utilisateurs', icon: 'pi pi-users', to: '/utilisateurs', permissions: ['users.view'] },
]

export function visibleMenu(canAny: (permissions: string[]) => boolean): MenuEntry[] {
  return MENU.filter((entry) => canAny(entry.permissions))
}
