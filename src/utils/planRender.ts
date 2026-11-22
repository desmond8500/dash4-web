import { codeFontSize, groupLegend, markerColor, planSymbol, type LegendEntry, type PlanIcon, type PlanMarker } from '@dash4/shared'

export interface LegendLayout {
  columns: number
  rowHeight: number
  headerHeight: number
  titleHeight: number
  padding: number
  iconSize: number
  colWidth: number
  blocks: Array<{ x: number; y: number }>
  width: number
  height: number
}

/** Échelle de la légende : suit la largeur du plan (référence 1600 px) et la taille choisie. */
export function legendScale(planWidth: number, size = 1): number {
  return Math.max(1, planWidth / 1600) * size
}

/** Largeur d'une légende en une colonne (à droite du plan ou posée dessus). */
export function legendPanelWidth(planWidth: number, size = 1): number {
  return Math.round(420 * legendScale(planWidth, size))
}

/**
 * Mise en page de la légende, comme une légende de plan d'exécution : un bloc par catégorie (titre puis une
 * ligne par icône avec la quantité), chaque bloc dans la colonne la moins haute. Tailles en px, relatives au coin
 * haut gauche de la légende. `maxColumns` = 1 pour une légende à droite ou posée sur le plan.
 */
export function legendLayout(blockSizes: number[], width: number, scale = legendScale(width), maxColumns = 4): LegendLayout {
  const padding = Math.round(24 * scale)
  const rowHeight = Math.round(30 * scale)
  const headerHeight = Math.round(36 * scale)
  const titleHeight = Math.round(40 * scale)
  const columns = Math.max(1, Math.min(maxColumns, Math.floor((width - padding * 2) / (360 * scale))))
  const colWidth = (width - padding * 2) / columns
  const blocks: Array<{ x: number; y: number }> = []
  const heights = new Array<number>(columns).fill(0)
  for (const rows of blockSizes) {
    const col = heights.indexOf(Math.min(...heights))
    blocks.push({ x: padding + col * colWidth, y: padding + titleHeight + heights[col]! })
    heights[col]! += headerHeight + rows * rowHeight + Math.round(12 * scale)
  }
  const height = blockSizes.length ? padding * 2 + titleHeight + Math.max(...heights) : 0
  return { columns, rowHeight, headerHeight, titleHeight, padding, iconSize: Math.round(22 * scale), colWidth, blocks, width, height }
}

/**
 * Place de la légende et taille de l'image finale.
 * - `below` : bande sous le plan, sur toute la largeur ;
 * - `right` : colonne à droite du plan (l'image s'élargit) ;
 * - `overlay` : posée sur le plan, coin haut gauche en (x, y) relatifs, gardée dans le plan.
 */
export function legendPlacement(
  blockSizes: number[],
  plan: { width: number; height: number },
  position: 'below' | 'right' | 'overlay',
  size = 1,
  at: { x: number; y: number } = { x: 0.7, y: 0.7 },
): { layout: LegendLayout | null; x: number; y: number; canvasWidth: number; canvasHeight: number } {
  if (!blockSizes.length) return { layout: null, x: 0, y: 0, canvasWidth: plan.width, canvasHeight: plan.height }
  const scale = legendScale(plan.width, size)
  if (position === 'below') {
    const layout = legendLayout(blockSizes, plan.width, scale)
    return { layout, x: 0, y: plan.height, canvasWidth: plan.width, canvasHeight: plan.height + layout.height }
  }
  const layout = legendLayout(blockSizes, legendPanelWidth(plan.width, size), scale, 1)
  if (position === 'right') {
    return { layout, x: plan.width, y: 0, canvasWidth: plan.width + layout.width, canvasHeight: Math.max(plan.height, layout.height) }
  }
  const x = Math.round(Math.min(Math.max(0, at.x * plan.width), Math.max(0, plan.width - layout.width)))
  const y = Math.round(Math.min(Math.max(0, at.y * plan.height), Math.max(0, plan.height - layout.height)))
  return { layout, x, y, canvasWidth: plan.width, canvasHeight: plan.height }
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

/** Dessine la légende (titre, un tableau par catégorie avec icône, libellé et quantité) en (ox, oy). */
function drawLegend(
  ctx: CanvasRenderingContext2D,
  groups: ReturnType<typeof groupLegend>,
  layout: LegendLayout,
  ox: number,
  oy: number,
  title: string | undefined,
  images: Map<number, HTMLImageElement>,
  framed: boolean,
): void {
  const line = Math.max(1, Math.round(layout.rowHeight / 20))
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ox, oy, layout.width, layout.height)
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = line * 2
  if (framed) ctx.strokeRect(ox + line, oy + line, layout.width - line * 2, layout.height - line * 2)
  else ctx.fillRect(ox, oy, layout.width, line * 2)
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${Math.round(layout.rowHeight * 0.75)}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(title ? `LÉGENDE — ${title}` : 'LÉGENDE', ox + layout.padding, oy + layout.padding, layout.width - layout.padding * 2)
  groups.forEach((group, gi) => {
    const x = ox + layout.blocks[gi]!.x
    const y0 = oy + layout.blocks[gi]!.y
    const w = layout.colWidth - (layout.columns > 1 ? layout.padding / 2 : 0)
    const qtyWidth = layout.rowHeight * 1.6
    ctx.fillStyle = '#111827'
    ctx.font = `700 ${Math.round(layout.rowHeight * 0.52)}px system-ui, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText(group.category.toUpperCase(), x, y0 + layout.headerHeight / 2, w - qtyWidth)
    ctx.textAlign = 'right'
    ctx.fillText('QTÉ', x + w, y0 + layout.headerHeight / 2)
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
    for (let i = 1; i < group.entries.length; i++) {
      ctx.moveTo(x, tableTop + i * layout.rowHeight)
      ctx.lineTo(x + w, tableTop + i * layout.rowHeight)
    }
    ctx.stroke()
    group.entries.forEach((entry, i) => {
      const cy = tableTop + i * layout.rowHeight + layout.rowHeight / 2
      ctx.save()
      ctx.translate(x + iconCol / 2, cy)
      drawGlyph(ctx, entry.icon, entry.color, layout.iconSize, entry.icon ? images.get(entry.icon.id) : undefined)
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
  ctx.restore()
}

export interface RenderOptions {
  base: HTMLImageElement
  markers: PlanMarker[]
  icons: Map<number, PlanIcon>
  images: Map<number, HTMLImageElement>
  /** Légende à dessiner (null : sans légende). */
  legend: LegendEntry[] | null
  legendPosition?: 'below' | 'right' | 'overlay'
  legendSize?: number
  legendAt?: { x: number; y: number }
  /** Nom affiché sous un repère, ou null. */
  labelOf: (m: PlanMarker) => string | null
  title?: string
  maxWidth?: number
}

/** Dessine le plan, ses repères (taille, rotation, couleur, nom) et la légende ; renvoie une image JPEG. */
export async function renderPlan(o: RenderOptions): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = renderSize(o.base.naturalWidth, o.base.naturalHeight, o.maxWidth)
  const groups = o.legend?.length ? groupLegend(o.legend) : []
  const place = legendPlacement(groups.map((g) => g.entries.length), { width, height }, o.legendPosition ?? 'below', o.legendSize ?? 1, o.legendAt)
  const canvas = document.createElement('canvas')
  canvas.width = place.canvasWidth
  canvas.height = place.canvasHeight
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

  if (place.layout) drawLegend(ctx, groups, place.layout, place.x, place.y, o.title, o.images, (o.legendPosition ?? 'below') === 'overlay')

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Impossible de créer l'aperçu du plan."))), 'image/jpeg', 0.88))
  return { blob, width: canvas.width, height: canvas.height }
}
