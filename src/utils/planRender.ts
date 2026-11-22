import { markerColor, planSymbol, type LegendEntry, type PlanIcon, type PlanMarker } from '@dash4/shared'

/** Mise en page de la légende sous le plan : colonnes, hauteur d'une ligne et hauteur totale (en px). */
export function legendLayout(count: number, width: number): { columns: number; rowHeight: number; height: number; padding: number; iconSize: number } {
  const scale = Math.max(1, width / 1600)
  const padding = Math.round(24 * scale)
  const rowHeight = Math.round(34 * scale)
  const columns = Math.max(1, Math.min(4, Math.floor((width - padding * 2) / (360 * scale))))
  const rows = Math.ceil(count / columns)
  return { columns, rowHeight, height: count ? padding * 2 + Math.round(30 * scale) + rows * rowHeight : 0, padding, iconSize: Math.round(24 * scale) }
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
  const path = new Path2D(planSymbol(icon?.symbol).path)
  ctx.save()
  ctx.scale(size / 26, size / 26)
  ctx.translate(-12, -12)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2.8
  ctx.strokeStyle = '#ffffff'
  ctx.stroke(path)
  ctx.fillStyle = color
  ctx.fill(path, 'evenodd')
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
  const layout = legendLayout(o.legend?.length ?? 0, width)
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

  if (o.legend?.length) {
    const top = height
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, top, width, layout.height)
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(0, top, width, Math.max(1, Math.round(layout.rowHeight / 20)))
    ctx.fillStyle = '#111827'
    ctx.font = `700 ${Math.round(layout.rowHeight * 0.6)}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(o.title ? `Légende — ${o.title}` : 'Légende', layout.padding, top + layout.padding)
    const colWidth = (width - layout.padding * 2) / layout.columns
    o.legend.forEach((entry, i) => {
      const col = i % layout.columns
      const row = Math.floor(i / layout.columns)
      const x = layout.padding + col * colWidth
      const y = top + layout.padding + layout.rowHeight * 1.1 + row * layout.rowHeight
      ctx.save()
      ctx.translate(x + layout.iconSize / 2, y + layout.iconSize / 2)
      drawGlyph(ctx, entry.icon, entry.color, layout.iconSize, entry.icon ? o.images.get(entry.icon.id) : undefined)
      ctx.restore()
      ctx.fillStyle = '#111827'
      ctx.font = `${Math.round(layout.rowHeight * 0.48)}px system-ui, sans-serif`
      ctx.textBaseline = 'middle'
      const text = `${entry.name} × ${entry.count}`
      ctx.fillText(text, x + layout.iconSize + layout.padding / 2, y + layout.iconSize / 2, colWidth - layout.iconSize - layout.padding)
    })
  }

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Impossible de créer l'aperçu du plan."))), 'image/jpeg', 0.88))
  return { blob, width: canvas.width, height: canvas.height }
}
