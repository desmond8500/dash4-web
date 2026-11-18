import { describe, expect, it } from 'vitest'
import { visibleMenu } from '../src/menu'
import { maskAccount, signatureImageError } from '../src/utils/company'
import { companyTabs } from '../src/utils/companyTabs'

describe('page Entreprise', () => {
  const tabsFor = (permissions: string[]) => companyTabs((p) => permissions.includes(p)).map((t) => t.value)

  it('montre au comptable l\'identité, la banque, la signature et les paramètres', () => {
    expect(tabsFor(['company.view', 'bank.view', 'signature.manage', 'settings.view'])).toEqual([
      'identity',
      'bank',
      'signature',
      'settings',
    ])
  })

  it('cache la banque et la signature sans leur permission', () => {
    expect(tabsFor(['company.view', 'settings.view'])).toEqual(['identity', 'settings'])
  })

  it('montre le menu Entreprise seulement avec une de ces permissions', () => {
    const menuFor = (permissions: string[]) =>
      visibleMenu((wanted) => wanted.some((p) => permissions.includes(p))).map((e) => e.to)
    expect(menuFor(['bank.view'])).toContain('/entreprise')
    expect(menuFor(['clients.view'])).not.toContain('/entreprise')
  })
})

describe('banque et signature', () => {
  it('masque les numéros de compte sauf les 4 derniers caractères', () => {
    expect(maskAccount('SN012 01001 036213452001 75')).toBe('•••• 0175')
    expect(maskAccount('123')).toBe('123')
    expect(maskAccount(null)).toBe('')
  })

  it("n'accepte que des PNG de 2 Mo au plus pour la signature et le cachet", () => {
    expect(signatureImageError({ type: 'image/png', size: 100_000 })).toBeNull()
    expect(signatureImageError({ type: 'image/jpeg', size: 100_000 })).toBe(
      "L'image doit être au format PNG (fond transparent conseillé).",
    )
    expect(signatureImageError({ type: 'image/png', size: 3 * 1024 * 1024 })).toBe("L'image ne peut pas dépasser 2 Mo.")
  })
})
