/**
 * Menu principal. Un élément n'apparaît que si l'utilisateur a au moins une des permissions listées.
 * Les modules suivants (projets, devis…) seront ajoutés ici au fil des livraisons.
 */
export interface MenuEntry {
  label: string
  icon: string
  to: string
  permissions: string[]
  /** Compteur affiché à côté du libellé. */
  badge?: 'client_requests'
}

export const MENU: MenuEntry[] = [
  { label: 'Tableau de bord', icon: 'pi pi-home', to: '/', permissions: ['dashboard.view', 'dashboard.view.own'] },
  { label: 'Clients', icon: 'pi pi-building', to: '/clients', permissions: ['clients.view', 'clients.view.own'] },
  {
    label: 'Demandes',
    icon: 'pi pi-inbox',
    to: '/demandes',
    permissions: ['client_requests.view', 'client_requests.view.own'],
    badge: 'client_requests',
  },
  { label: 'Projets', icon: 'pi pi-briefcase', to: '/projets', permissions: ['projects.view', 'projects.view.own'] },
  { label: 'Devis', icon: 'pi pi-file-edit', to: '/devis', permissions: ['quotes.view', 'quotes.view.own'] },
  { label: 'Contacts', icon: 'pi pi-address-book', to: '/contacts', permissions: ['clients.view', 'clients.view.own'] },
  { label: 'Utilisateurs', icon: 'pi pi-users', to: '/utilisateurs', permissions: ['users.view'] },
  {
    label: 'Entreprise',
    icon: 'pi pi-cog',
    to: '/entreprise',
    permissions: ['company.view', 'bank.view', 'signature.manage', 'settings.view'],
  },
]

export function visibleMenu(canAny: (permissions: string[]) => boolean): MenuEntry[] {
  return MENU.filter((entry) => canAny(entry.permissions))
}
