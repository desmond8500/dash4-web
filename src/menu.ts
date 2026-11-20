/**
 * Menu principal. Un élément n'apparaît que si l'utilisateur a au moins une des permissions listées
 * (aucune permission listée : visible de tous).
 * Les modules suivants (projets, devis…) seront ajoutés ici au fil des livraisons.
 */
export interface MenuEntry {
  label: string
  icon: string
  to: string
  permissions: string[]
  /** Compteur affiché à côté du libellé. */
  badge?: 'client_requests' | 'messages'
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
  { label: 'Messages', icon: 'pi pi-comments', to: '/messages', permissions: [], badge: 'messages' },
  { label: 'Tâches', icon: 'pi pi-check-square', to: '/taches', permissions: ['tasks.view', 'tasks.view.own'] },
  { label: 'Planning', icon: 'pi pi-calendar', to: '/planning', permissions: ['tasks.view', 'tasks.view.own'] },
  { label: 'Journaux', icon: 'pi pi-book', to: '/journaux', permissions: ['journals.view', 'journals.view.own'] },
  {
    label: 'Espace technicien',
    icon: 'pi pi-key',
    to: '/espace-technicien',
    permissions: ['tech_shares.view', 'tech_shares.view.own', 'tech_access_requests.view', 'tech_access_requests.view.own'],
  },
  { label: 'Devis', icon: 'pi pi-file-edit', to: '/devis', permissions: ['quotes.view', 'quotes.view.own'] },
  { label: 'Factures', icon: 'pi pi-receipt', to: '/factures', permissions: ['invoices.view'] },
  { label: 'Contrats', icon: 'pi pi-file-check', to: '/contrats', permissions: ['contracts.view'] },
  { label: 'Stock', icon: 'pi pi-box', to: '/stock', permissions: ['stock.view'] },
  { label: 'Achats', icon: 'pi pi-shopping-cart', to: '/achats', permissions: ['purchases.view', 'purchases.view.own'] },
  { label: 'Dépenses', icon: 'pi pi-wallet', to: '/depenses', permissions: ['accounting.view', 'accounting.view.own'] },
  { label: 'Comptabilité', icon: 'pi pi-chart-bar', to: '/comptabilite', permissions: ['accounting.view'] },
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
  // Sans permission listée : visible de tous (messagerie)
  return MENU.filter((entry) => entry.permissions.length === 0 || canAny(entry.permissions))
}
