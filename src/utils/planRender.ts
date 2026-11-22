import { codeFontSize, groupLegend, markerColor, planSymbol, type LegendEntry, type PlanIcon, type PlanMarker } from '@dash4/shared'

/**
 * Mise en page de la légende sous le plan, comme une légende de plan d'exécution : un bloc par catégorie
 * (titre puis une ligne par icône avec la quantité), blocs rangés en colonnes. Tailles en px.
 */
export function legendLayout(blockSizes: number[], width: number): {
  columns: number
  rowHeight: number
  headerHeight: number
  padding: number
  iconSize: number
  colWidth: number
  blocks: Array<{ x: number; y: number }>
  height: number
} {
  const scale = Math.max(1, width / 1600)
  const padding = Math.round(24 * scale)
  const rowHeight = Math.round(30 * scale)
  const headerHeight = Math.round(36 * scale)
  const titleHeight = Math.round(40 * scale)
  const columns = Math.max(1, Math.min(4, Math.floor((width - padding * 2) / (360 * scale))))
  const colWidth = (width - padding * 2) / columns
  const blocks: Array<{ x: number; y: number }> = []
  // Chaque bloc va dans la colonne la moins haute
  const heights = new Array<number>(columns).fill(0)
  for (const rows of blockSizes) {
    const col = heights.indexOf(Math.min(...heights))
    blocks.push({ x: padding + col * colWidth, y: padding + titleHeight + heights[col]! })
    heights[col]! += headerHeight + rows * rowHeight + Math.round(12 * scale)
  }
  const height = blockSizes.length ? padding * 2 + titleHeight + Math.max(...heights) : 0
  return { columns, rowHeight, headerHeight, padding, iconSize: Math.round(22 * scale), colWidth, blocks, height }
}

/** Taille de rendu : la largeur d'origine, ramenée à `maxWidth` au plus. */
export function renderSize(width: number, height: number, maxWidth = 3000): { width: number; height: number; scale: number } {
  const scale = width > maxWidth ? maxWidth / width : 1
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale }
}

function drawGlyph(ctx: CanvasRenderingContext2D, icon: PlanIcon | null, color: string, size: number, image?: HTMLImageElement): void {
  if (icon?.file_path && image && image.complete && image.naturalWidth) {
    const ratio = image.naturalWidth / image.naturalHeight
    const w = ratio >= 1 ? size : size * ratio
    const h = ratio >= 1 ? size / ratio : size
    ctx.drawImage(image, -w / 2, -h / 2, w, h)
    return
  }
  const symbol = icon?.symbol
  const path = new Path2D(planSymbol(symbol).path)
  ctx.save()
  ctx.scale(size / 26, size / 26)
  ctx.translate(-12, -12)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2.8
  ctx.strokeStyle = '#ffffff'
  ctx.stroke(path)
  ctx.fillStyle = color
  ctx.fill(path, 'evenodd')
  if (icon?.secondary_color) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(-1, 12, 26, 13)
    ctx.clip()
    ctx.fillStyle = icon.secondary_color
    ctx.fill(path, 'evenodd')
    ctx.restore()
  }
  const code = icon?.code?.trim()
  if (code) {
    const fs = codeFontSize(code, symbol)
    ctx.font = `700 ${fs}px Arial, Helvetica, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = icon?.text_color ?? '#ffffff'
    ctx.fillText(code, 12, 12 + fs * 0.36)
  }
  ctx.restore()
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number): void {
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineWidth = Math.max(2, fontSize / 4)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = '#111827'
  ctx.fillText(text, x, y)
}

export interface RenderOptions {
  base: HTMLImageElement
  markers: PlanMarker[]
  icons: Map<number, PlanIcon>
  images: Map<number, HTMLImageElement>
  /** Légende à dessiner sous le plan (null : sans légende). */
  legend: LegendEntry[] | null
  /** Nom affiché sous un repère, ou null. */
  labelOf: (m: PlanMarker) => string | null
  title?: string
  maxWidth?: number
}

/** Dessine le plan, ses repères (taille, rotation, couleur, nom) et la légende ; renvoie une image JPEG. */
export async function renderPlan(o: RenderOptions): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = renderSize(o.base.naturalWidth, o.base.naturalHeight, o.maxWidth)
  const groups = o.legend?.length ? groupLegend(o.legend) : []
  const layout = legendLayout(groups.map((g) => g.entries.length), width)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height + layout.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(o.base, 0, 0, width, height)

  for (const m of o.markers) {
    const icon = (m.icon_id !== null && o.icons.get(m.icon_id)) || null
    const size = m.size * width
    const cx = m.x * width
    const cy = m.y * height
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((m.rotation * Math.PI) / 180)
    drawGlyph(ctx, icon, markerColor(m, icon), size, icon ? o.images.get(icon.id) : undefined)
    ctx.restore()
    const label = o.labelOf(m)
    if (label) drawLabel(ctx, label, cx, cy + size / 2 + 2, Math.max(11, Math.round(size * 0.38)))
  }

  if (groups.length) {
    const top = height
    const line = Math.max(1, Math.round(layout.rowHeight / 20))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, top, width, layout.height)
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, top, width, line * 2)
    ctx.font = `700 ${Math.round(layout.rowHeight * 0.75)}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(o.title ? `LÉGENDE — ${o.title}` : 'LÉGENDE', layout.padding, top + layout.padding)
    groups.forEach((group, gi) => {
      const { x, y: by } = layout.blocks[gi]!
      const y0 = top + by
      const w = layout.colWidth - layout.padding / 2
      const qtyWidth = layout.rowHeight * 1.6
      // Titre de catégorie
      ctx.fillStyle = '#111827'
      ctx.font = `700 ${Math.round(layout.rowHeight * 0.52)}px system-ui, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(group.category.toUpperCase(), x, y0 + layout.headerHeight / 2, w - qtyWidth)
      ctx.textAlign = 'right'
      ctx.fillText('QTÉ', x + w, y0 + layout.headerHeight / 2)
      // Tableau : cadre, lignes
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = line
      const tableTop = y0 + layout.headerHeight
      const tableHeight = group.entries.length * layout.rowHeight
      ctx.strokeRect(x, tableTop, w, tableHeight)
      const iconCol = layout.iconSize + layout.padding / 2
      ctx.beginPath()
      ctx.moveTo(x + iconCol, tableTop)
      ctx.lineTo(x + iconCol, tableTop + tableHeight)
      ctx.moveTo(x + w - qtyWidth, tableTop)
      ctx.lineTo(x + w - qtyWidth, tableTop + tableHeight)
      group.entries.forEach((entry, i) => {
        if (i) {
          ctx.moveTo(x, tableTop + i * layout.rowHeight)
          ctx.lineTo(x + w, tableTop + i * layout.rowHeight)
        }
      })
      ctx.stroke()
      group.entries.forEach((entry, i) => {
        const cy = tableTop + i * layout.rowHeight + layout.rowHeight / 2
        ctx.save()
        ctx.translate(x + iconCol / 2, cy)
        drawGlyph(ctx, entry.icon, entry.color, layout.iconSize, entry.icon ? o.images.get(entry.icon.id) : undefined)
        ctx.restore()
        ctx.fillStyle = '#111827'
        ctx.font = `${Math.round(layout.rowHeight * 0.46)}px system-ui, sans-serif`
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText(entry.name, x + iconCol + layout.padding / 3, cy, w - iconCol - qtyWidth - layout.padding / 2)
        ctx.textAlign = 'center'
        ctx.fillText(String(entry.count), x + w - qtyWidth / 2, cy)
      })
    })
  }

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Impossible de créer l'aperçu du plan."))), 'image/jpeg', 0.88))
  return { blob, width: canvas.width, height: canvas.height }
}
