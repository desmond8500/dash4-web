import type { PracticalToolLink, PracticalToolLinkType } from '@dash4/shared'
import type { RouteLocationRaw } from 'vue-router'

/** Types de fiches auxquelles on lie un outil pratique. */
export const LINK_TYPES: Array<{ value: PracticalToolLinkType; label: string; singular: string; searchLabel: string }> = [
  { value: 'brands', label: 'Marques', singular: 'Marque', searchLabel: 'une marque' },
  { value: 'providers', label: 'Fournisseurs', singular: 'Fournisseur', searchLabel: 'un fournisseur' },
  { value: 'articles', label: 'Articles', singular: 'Article', searchLabel: 'un article (désignation, référence)' },
]

/** Fiche de la marque, du fournisseur ou de l'article lié. */
export function linkRoute(link: Pick<PracticalToolLink, 'type' | 'target'>): RouteLocationRaw {
  const name = { brands: 'brand', providers: 'provider', articles: 'article' }[link.type]
  return { name, params: { id: link.target.id } }
}
