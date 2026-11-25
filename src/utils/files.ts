import { downloadedFileName } from '@dash4/shared'

/** Enregistre le fichier sur l'ordinateur sous son nom (« Client - Objet - Référence.pdf »). */
export function saveFile(blob: Blob, fallbackName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadedFileName(blob, fallbackName)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Ouvre un PDF (ou un fichier) dans un nouvel onglet, titré de son nom, avec un bouton « Télécharger »
 * qui l'enregistre sous ce nom : le lecteur PDF du navigateur, lui, ne connaît pas le nom d'une copie locale.
 * Onglet bloqué par le navigateur : le fichier est enregistré directement.
 */
export function openFile(blob: Blob, fallbackName = 'document.pdf'): void {
  const name = downloadedFileName(blob, fallbackName)
  const win = window.open('', '_blank')
  if (!win) return saveFile(blob, name)

  const url = URL.createObjectURL(blob)
  const doc = win.document
  doc.title = name
  const style = doc.createElement('style')
  style.textContent = `
    html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; background: #525659; }
    header { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem; background: #1f2937; color: #fff; }
    header span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.95rem; }
    header a { color: #fff; background: #2563eb; padding: 0.4rem 0.9rem; border-radius: 6px; text-decoration: none; font-size: 0.9rem; }
    iframe { display: block; width: 100%; height: calc(100% - 46px); border: 0; }`
  doc.head.appendChild(style)

  const header = doc.createElement('header')
  const title = doc.createElement('span')
  title.textContent = name
  const link = doc.createElement('a')
  link.href = url
  link.download = name
  link.textContent = 'Télécharger'
  header.append(title, link)
  const frame = doc.createElement('iframe')
  frame.src = url
  frame.title = name
  doc.body.append(header, frame)

  const revoke = () => URL.revokeObjectURL(url)
  win.addEventListener('pagehide', revoke)
  setTimeout(revoke, 60 * 60_000)
}
