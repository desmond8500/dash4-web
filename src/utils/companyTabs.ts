export interface CompanyTab {
  value: 'identity' | 'bank' | 'signature' | 'settings'
  label: string
  icon: string
  permission: string
}

/** Onglets de la page Entreprise, chacun réservé à sa permission (l'API vérifie aussi). */
export const COMPANY_TABS: CompanyTab[] = [
  { value: 'identity', label: 'Identité', icon: 'pi pi-building', permission: 'company.view' },
  { value: 'bank', label: 'Banque', icon: 'pi pi-wallet', permission: 'bank.view' },
  { value: 'signature', label: 'Signature et cachet', icon: 'pi pi-pen-to-square', permission: 'signature.manage' },
  { value: 'settings', label: 'TVA, devise et numérotation', icon: 'pi pi-cog', permission: 'settings.view' },
]

export function companyTabs(can: (permission: string) => boolean): CompanyTab[] {
  return COMPANY_TABS.filter((t) => can(t.permission))
}

/** Permissions qui donnent accès à la page (menu et route). */
export const COMPANY_PAGE_PERMISSIONS = COMPANY_TABS.map((t) => t.permission)
