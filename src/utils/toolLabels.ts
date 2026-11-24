import { qrSvg, toolQrContent } from '@dash4/shared'
import type { Tool } from '@dash4/shared'

/** Étiquettes QR de l'outillage : planches A4 ou étiquette seule (rouleau), imprimées depuis le navigateur. */

export type LabelFormat = 'a4-24' | 'a4-65' | 'roll'

export interface LabelFormatInfo {
  value: LabelFormat
  label: string
  /** Étiquettes par page. */
  perPage: number
}

export const LABEL_FORMATS: LabelFormatInfo[] = [
  { value: 'a4-24', label: 'Planche A4 de 24 (70 × 37 mm)', perPage: 24 },
  { value: 'a4-65', label: 'Planche A4 de 65 (38 × 21 mm)', perPage: 65 },
  { value: 'roll', label: 'Une étiquette par page (rouleau 50 × 30 mm)', perPage: 1 },
]

const PAGE_CSS: Record<LabelFormat, string> = {
  'a4-24': `@page { size: A4; margin: 0 }
    .sheet { display: grid; grid-template-columns: repeat(3, 70mm); grid-auto-rows: 37.125mm; width: 210mm; }
    .label { padding: 3mm 3mm 3mm 4mm; gap: 3mm; }
    .qr { width: 31mm; height: 31mm; }
    .name { font-size: 10pt; } .code { font-size: 12pt; }`,
  'a4-65': `@page { size: A4; margin: 10.7mm 4.7mm }
    .sheet { display: grid; grid-template-columns: repeat(5, 38.1mm); column-gap: 2.5mm; grid-auto-rows: 21.2mm; }
    .label { padding: 1.5mm; gap: 1.5mm; }
    .qr { width: 18mm; height: 18mm; }
    .name { font-size: 6.5pt; -webkit-line-clamp: 2; } .code { font-size: 7.5pt; }`,
  roll: `@page { size: 50mm 30mm; margin: 0 }
    .sheet { display: block; }
    .label { width: 50mm; height: 30mm; padding: 2mm; gap: 2mm; break-after: page; }
    .qr { width: 26mm; height: 26mm; }
    .name { font-size: 8pt; } .code { font-size: 10pt; }`,
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * Page HTML des étiquettes, prête à imprimer : QR code (adresse de la fiche de l'outil), nom et numéro.
 * `skip` laisse vides les premières étiquettes d'une planche déjà entamée.
 */
export function toolLabelsHtml(
  tools: Array<Pick<Tool, 'id' | 'name' | 'code'>>,
  options: { format: LabelFormat; origin: string | null; skip?: number; owner?: string | null },
): string {
  const skip = options.format === 'roll' ? 0 : Math.max(0, Math.floor(options.skip ?? 0))
  const blanks = '<div class="label blank"></div>'.repeat(skip)
  const labels = tools
    .map((t) => {
      const qr = qrSvg(toolQrContent(t.id, options.origin), { margin: 1 })
      return `<div class="label"><div class="qr">${qr}</div><div class="text">` +
        `<div class="name">${escape(t.name)}</div>` +
        (t.code ? `<div class="code">${escape(t.code)}</div>` : '') +
        (options.owner ? `<div class="owner">${escape(options.owner)}</div>` : '') +
        `</div></div>`
    })
    .join('')
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Étiquettes de l'outillage</title><style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .label { display: flex; align-items: center; overflow: hidden; break-inside: avoid; }
    .qr { flex: none; } .qr svg { width: 100%; height: 100%; display: block; }
    .text { min-width: 0; display: flex; flex-direction: column; gap: 0.6mm; }
    .name { font-weight: 600; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .code { font-family: 'Courier New', monospace; font-weight: 700; }
    .owner { font-size: 6pt; color: #444; }
    @media screen { body { background: #eee; } .sheet { background: #fff; margin: 1rem auto; } .label { outline: 1px dashed #ccc; } }
    ${PAGE_CSS[options.format]}
  </style></head><body><div class="sheet">${blanks}${labels}</div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 200) })</script></body></html>`
}

/** Ouvre les étiquettes dans un nouvel onglet et lance l'impression (« Enregistrer en PDF » pour imprimer plus tard). */
export function printToolLabels(html: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}
