import type { TechShare, TechSharePayload, TechShareCategory } from '@dash4/shared'

/** Espace technicien : affichage des expirations et préparation des envois. */

const pad = (n: number) => String(n).padStart(2, '0')

/** « expire dans 3 h », « expire demain à 18:00 », « expirée »… (heure de l'appareil, l'API tranche). */
export function expiryLabel(share: Pick<TechShare, 'expired' | 'expires_at' | 'expires_with_task'>, now: Date = new Date()): string {
  if (share.expired) return 'Expirée'
  if (!share.expires_at) return share.expires_with_task ? 'Jusqu\'à la fin de la tâche' : 'Sans expiration'
  const at = new Date(share.expires_at)
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000)
  if (minutes <= 0) return 'Expirée'
  if (minutes < 60) return `Expire dans ${minutes} min`
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(at) - day(now)) / 86_400_000)
  if (days === 0) return `Expire aujourd'hui à ${time}`
  if (days === 1) return `Expire demain à ${time}`
  return `Expire le ${pad(at.getDate())}/${pad(at.getMonth() + 1)} à ${time}`
}

/** Expiration proposée : ce soir 19:00, ou demain 19:00 s'il est déjà plus tard. */
export function defaultExpiry(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0)
  if (d.getTime() - now.getTime() < 60 * 60_000) d.setDate(d.getDate() + 1)
  return d
}

export interface ShareForm {
  category: TechShareCategory
  title: string
  content: string
  project_id: number | null
  task_id: number | null
  expires_at: Date | null
  expires_with_task: boolean
  recipients: number[]
}

/** Erreur à afficher avant l'envoi, ou null si le formulaire est complet. */
export function shareFormError(f: ShareForm, now: Date = new Date()): string | null {
  if (!f.title.trim()) return 'Indiquez un titre.'
  if (!f.recipients.length) return 'Choisissez au moins un destinataire.'
  if (f.expires_with_task) return f.task_id ? null : 'Choisissez la tâche.'
  if (!f.expires_at) return "Indiquez jusqu'à quand l'information reste visible."
  if (f.expires_at.getTime() <= now.getTime()) return "La date d'expiration doit être dans le futur."
  return null
}

export function sharePayload(f: ShareForm): TechSharePayload & { title: string; recipients: number[] } {
  return {
    category: f.category,
    title: f.title.trim(),
    content: f.content.trim() || null,
    project_id: f.project_id,
    task_id: f.task_id,
    expires_with_task: f.expires_with_task,
    expires_at: f.expires_with_task ? null : (f.expires_at?.toISOString() ?? null),
    recipients: f.recipients,
  }
}
