import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Affiche une page d'un plan PDF comme une image (PDF.js, licence Apache 2.0) : les marqueurs se posent
 * dessus comme sur un plan en image. Rendu à 2400 px de large au plus, pour zoomer sans flou.
 */
export async function pdfPageImage(data: ArrayBuffer, pageNumber = 1, maxWidth = 2400): Promise<{ url: string; pages: number; width: number; height: number }> {
  const pdf = await getDocument({ data: new Uint8Array(data) }).promise
  try {
    const page = await pdf.getPage(Math.min(Math.max(pageNumber, 1), pdf.numPages))
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(maxWidth / base.width, 4) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const canvasContext = canvas.getContext('2d')!
    await page.render({ canvas, canvasContext, viewport } as Parameters<typeof page.render>[0]).promise
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Rendu du plan impossible.'))), 'image/png'))
    return { url: URL.createObjectURL(blob), pages: pdf.numPages, width: canvas.width, height: canvas.height }
  } finally {
    void pdf.destroy()
  }
}
