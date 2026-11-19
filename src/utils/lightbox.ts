import PhotoSwipe from 'photoswipe'
import 'photoswipe/style.css'
import type { Document } from '@dash4/shared'
import { api } from '@/services/api'

/**
 * Visionneuse d'images plein écran (PhotoSwipe, licence MIT) : zoom, glisser d'une photo à l'autre,
 * clavier, légende. Les fichiers sont privés : on les télécharge avec le jeton puis on les affiche.
 */
export interface LightboxImage {
  /** Adresse de l'image (blob:, data: ou https:). */
  src: string
  caption?: string
}

export const isImageDocument = (d: Pick<Document, 'mime_type'>) => (d.mime_type ?? '').startsWith('image/')

const cache = new Map<number, Promise<string>>()

/** Adresse locale d'un document image, téléchargé une seule fois par session. */
export function documentUrl(doc: Document): Promise<string> {
  let url = cache.get(doc.id)
  if (!url) {
    url = api.documents.download(doc).then((blob) => URL.createObjectURL(blob))
    url.catch(() => cache.delete(doc.id))
    cache.set(doc.id, url)
  }
  return url
}

/** Dimensions réelles de l'image (PhotoSwipe en a besoin pour le zoom). */
export function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 1600, height: img.naturalHeight || 1200 })
    img.onerror = () => resolve({ width: 1600, height: 1200 })
    img.src = src
  })
}

export async function openLightbox(images: LightboxImage[], index = 0): Promise<void> {
  if (!images.length) return
  const slides: Array<{ src: string; alt: string; width: number; height: number }> = await Promise.all(
    images.map(async (i) => ({ src: i.src, alt: i.caption ?? '', ...(await imageSize(i.src)) })),
  )
  const pswp = new PhotoSwipe({
    dataSource: slides,
    index: Math.min(Math.max(index, 0), slides.length - 1),
    bgOpacity: 0.92,
    showHideAnimationType: 'fade',
    wheelToZoom: true,
    closeTitle: 'Fermer',
    zoomTitle: 'Zoomer',
    arrowPrevTitle: 'Précédente',
    arrowNextTitle: 'Suivante',
    errorMsg: "L'image n'a pas pu être chargée.",
    indexIndicatorSep: ' / ',
  })
  // Légende sous l'image : nom du fichier
  pswp.on('uiRegister', () => {
    pswp.ui?.registerElement({
      name: 'caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit: (el) => {
        el.className = 'pswp__dash4-caption'
        const update = () => {
          el.textContent = pswp.currSlide?.data.alt ?? ''
        }
        pswp.on('change', update)
        update()
      },
    })
  })
  pswp.init()
}

/** Ouvre la visionneuse sur une liste de documents (seules les images sont montrées). */
export async function openDocuments(docs: Document[], start: Document): Promise<void> {
  const images = docs.filter(isImageDocument)
  const urls = await Promise.all(images.map((d) => documentUrl(d).catch(() => null)))
  const list = images.flatMap((d, i) => (urls[i] ? [{ src: urls[i]!, caption: d.name, id: d.id }] : []))
  await openLightbox(list, Math.max(list.findIndex((x) => x.id === start.id), 0))
}
