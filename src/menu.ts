/**
 * Menu principal, en menus et sous-menus. Un élément n'apparaît que si l'utilisateur a au moins une des
 * permissions listées (aucune permission listée : visible de tous) ; un menu sans sous-menu visible disparaît.
 */
export type MenuGroupKey = 'clients' | 'projects' | 'sales' | 'stock' | 'equipment' | 'finance' | 'admin'

export interface MenuEntry {
  label: string
  icon: string
  to: string
  permissions: string[]
  /** Compteur affiché à côté du libellé. */
  badge?: 'client_requests' | 'messages'
  /** Permissions toutes nécessaires en plus (ex. voir les prix). */
  allOf?: string[]
  /** Menu qui le contient ; sans menu : lien direct, en haut. */
  group?: MenuGroupKey
}

export interface MenuGroup {
  key: MenuGroupKey
  label: string
  icon: string
}

export const MENU_GROUPS: MenuGroup[] = [
  { key: 'clients', label: 'Clients', icon: 'pi pi-building' },
  { key: 'projects', label: 'Projets', icon: 'pi pi-briefcase' },
  { key: 'sales', label: 'Ventes', icon: 'pi pi-file-edit' },
  { key: 'stock', label: 'Stock et achats', icon: 'pi pi-box' },
  { key: 'equipment', label: 'Matériel', icon: 'pi pi-wrench' },
  { key: 'finance', label: 'Finances', icon: 'pi pi-wallet' },
  { key: 'admin', label: 'Administration', icon: 'pi pi-cog' },
]

export const MENU: MenuEntry[] = [
  { label: 'Tableau de bord', icon: 'pi pi-home', to: '/', permissions: ['dashboard.view', 'dashboard.view.own'] },
  { label: 'Messages', icon: 'pi pi-comments', to: '/messages', permissions: [], badge: 'messages' },

  { group: 'clients', label: 'Clients', icon: 'pi pi-building', to: '/clients', permissions: ['clients.view', 'clients.view.own'] },
  { group: 'clients', label: 'Contacts', icon: 'pi pi-address-book', to: '/contacts', permissions: ['clients.view', 'clients.view.own'] },
  {
    group: 'clients',
    label: 'Demandes',
    icon: 'pi pi-inbox',
    to: '/demandes',
    permissions: ['client_requests.view', 'client_requests.view.own'],
    badge: 'client_requests',
  },

  { group: 'projects', label: 'Projets', icon: 'pi pi-briefcase', to: '/projets', permissions: ['projects.view', 'projects.view.own'] },
  { group: 'projects', label: 'Tâches', icon: 'pi pi-check-square', to: '/taches', permissions: ['tasks.view', 'tasks.view.own'] },
  { group: 'projects', label: 'Planning', icon: 'pi pi-calendar', to: '/planning', permissions: ['tasks.view', 'tasks.view.own'] },
  { group: 'projects', label: 'Journaux', icon: 'pi pi-book', to: '/journaux', permissions: ['journals.view', 'journals.view.own'] },
  {
    group: 'projects',
    label: 'Espace technicien',
    icon: 'pi pi-key',
    to: '/espace-technicien',
    permissions: ['tech_shares.view', 'tech_shares.view.own', 'tech_access_requests.view', 'tech_access_requests.view.own'],
  },

  { group: 'sales', label: 'Devis', icon: 'pi pi-file-edit', to: '/devis', permissions: ['quotes.view', 'quotes.view.own'] },
  { group: 'sales', label: 'Modèles de devis', icon: 'pi pi-clone', to: '/devis/modeles', permissions: ['quotes.create', 'quotes.update', 'quotes.update.own'] },
  { group: 'sales', label: 'Factures', icon: 'pi pi-receipt', to: '/factures', permissions: ['invoices.view'] },
  { group: 'sales', label: 'Échéancier', icon: 'pi pi-calendar-clock', to: '/echeancier', permissions: ['invoices.view'] },
  { group: 'sales', label: 'Contrats', icon: 'pi pi-file-check', to: '/contrats', permissions: ['contracts.view'] },

  { group: 'stock', label: 'Articles', icon: 'pi pi-box', to: '/stock', permissions: ['stock.view'] },
  { group: 'stock', label: 'Mouvements', icon: 'pi pi-arrow-right-arrow-left', to: '/stock/mouvements', permissions: ['stock.view'] },
  { group: 'stock', label: 'Emplacements', icon: 'pi pi-map-marker', to: '/stock/emplacements', permissions: ['stock.view'] },
  { group: 'stock', label: 'Achats', icon: 'pi pi-shopping-cart', to: '/achats', permissions: ['purchases.view', 'purchases.view.own'] },
  {
    group: 'stock',
    label: 'Fournisseurs et marques',
    icon: 'pi pi-truck',
    to: '/stock/fournisseurs',
    permissions: ['stock.view', 'purchases.view', 'purchases.view.own'],
  },
  { group: 'stock', label: 'Icônes des plans', icon: 'pi pi-images', to: '/stock/icones', permissions: ['stock.view', 'sites.view', 'sites.view.own'] },

  { group: 'equipment', label: 'Outillage', icon: 'pi pi-wrench', to: '/stock/outillage', permissions: ['tools.view', 'tools.view.own'] },
  { group: 'equipment', label: 'Parc automobile', icon: 'pi pi-car', to: '/parc', permissions: ['vehicles.view', 'vehicles.view.own'] },
  // Calculs et conversions (texte Galaxy Dimension…) : ouverts à tous
  { group: 'equipment', label: 'Outils pratiques', icon: 'pi pi-calculator', to: '/outils-pratiques', permissions: [] },

  { group: 'finance', label: 'Dépenses', icon: 'pi pi-wallet', to: '/depenses', permissions: ['accounting.view', 'accounting.view.own'] },
  { group: 'finance', label: 'Comptabilité', icon: 'pi pi-chart-bar', to: '/comptabilite', permissions: ['accounting.view'] },
  // Les exports comptables demandent aussi de voir les prix (le magasinier exporte seulement le stock)
  { group: 'finance', label: 'Exports', icon: 'pi pi-file-export', to: '/exports', permissions: ['exports.run'], allOf: ['prices.view'] },

  { group: 'admin', label: 'Utilisateurs', icon: 'pi pi-users', to: '/utilisateurs', permissions: ['users.view'] },
  {
    group: 'admin',
    label: 'Entreprise',
    icon: 'pi pi-cog',
    to: '/entreprise',
    permissions: ['company.view', 'bank.view', 'signature.manage', 'settings.view'],
  },
  { group: 'admin', label: 'Sauvegardes', icon: 'pi pi-database', to: '/sauvegardes', permissions: ['backups.manage'] },
]

/** Entrées visibles, à plat, dans l'ordre du menu. */
export function visibleMenu(canAny: (permissions: string[]) => boolean): MenuEntry[] {
  // Sans permission listée : visible de tous (messagerie)
  return MENU.filter(
    (entry) =>
      (entry.permissions.length === 0 || canAny(entry.permissions)) && (entry.allOf ?? []).every((p) => canAny([p])),
  )
}

export type MenuNode = { kind: 'link'; entry: MenuEntry } | { kind: 'group'; group: MenuGroup; entries: MenuEntry[] }

/**
 * Menus et sous-menus à partir des entrées visibles : liens directs en haut, puis les menus dans l'ordre
 * de MENU_GROUPS. Un menu avec une seule entrée visible devient un lien direct (pas de sous-menu pour un seul lien).
 */
export function menuTree(entries: MenuEntry[]): MenuNode[] {
  const direct: MenuNode[] = entries.filter((e) => !e.group).map((entry) => ({ kind: 'link', entry }))
  const groups: MenuNode[] = MENU_GROUPS.flatMap((group): MenuNode[] => {
    const children = entries.filter((e) => e.group === group.key)
    if (children.length === 0) return []
    if (children.length === 1) return [{ kind: 'link', entry: children[0]! }]
    return [{ kind: 'group', group, entries: children }]
  })
  return [...direct, ...groups]
}

/**
 * Entrée du menu de la page ouverte : celle dont l'adresse est le plus long début du chemin
 * (« /stock/articles/5 » → Articles, « /stock/outillage/2 » → Outillage) ; « / » seulement sur l'accueil.
 */
export function activeEntry(entries: MenuEntry[], path: string): MenuEntry | null {
  let best: MenuEntry | null = null
  for (const entry of entries) {
    const matches = entry.to === '/' ? path === '/' : path === entry.to || path.startsWith(`${entry.to}/`)
    if (matches && (!best || entry.to.length > best.to.length)) best = entry
  }
  return best
}
