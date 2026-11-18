import type { ProjectStatus } from '@dash4/shared'
import type { Severity } from './clientRequests'

export function projectStatusSeverity(status: ProjectStatus): Severity {
  switch (status) {
    case 'in_progress':
      return 'info'
    case 'planned':
      return 'secondary'
    case 'on_hold':
      return 'warn'
    case 'completed':
      return 'success'
    default:
      return 'danger'
  }
}

/** Date courte : « 01/12/2026 ». */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : ''
}

/** Période d'un projet : « du 01/12/2026 au 15/01/2027 », « à partir du … », « jusqu'au … ». */
export function periodLabel(start: string | null, end: string | null): string {
  if (start && end) return `du ${formatDate(start)} au ${formatDate(end)}`
  if (start) return `à partir du ${formatDate(start)}`
  if (end) return `jusqu'au ${formatDate(end)}`
  return ''
}

/** Date « AAAA-MM-JJ » pour l'API, à partir d'une date choisie dans le calendrier (heure locale). */
export function toApiDate(date: Date | null): string | null {
  if (!date) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fromApiDate(iso: string | null): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

/** Lien vers la carte : coordonnées GPS en priorité, sinon l'adresse. */
export function mapsUrl(lat: number | null, lng: number | null, address: string | null): string | null {
  if (lat !== null && lng !== null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  return null
}

/** Taille lisible : « 850 o », « 12 Ko », « 3,4 Mo ». */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

export function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pi pi-file-pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return 'pi pi-image'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'pi pi-file-excel'
  if (['doc', 'docx', 'odt', 'txt'].includes(ext)) return 'pi pi-file-word'
  return 'pi pi-file'
}

/** Mêmes règles que l'API, vérifiées avant l'envoi. */
export const DOCUMENT_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'csv', 'txt',
  'dwg', 'dxf', 'zip',
]
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024

export function documentError(file: { name: string; size: number }): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!DOCUMENT_EXTENSIONS.includes(ext)) return `Format non accepté (${ext || 'sans extension'}).`
  if (file.size > DOCUMENT_MAX_BYTES) return 'Le fichier dépasse 20 Mo.'
  return null
}

/** Adresse web complète : ajoute https:// si l'utilisateur l'a oublié. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
