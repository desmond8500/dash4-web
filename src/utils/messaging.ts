import type { Conversation, MessagingUser } from '@dash4/shared'

/** Notification du navigateur : seulement s'il y a plus de non lus qu'avant et que l'onglet est caché. */
export function shouldNotify(before: number, after: number, visibility: string, permission: string): boolean {
  return after > before && visibility === 'hidden' && permission === 'granted'
}

/** Personnes que l'on peut encore ajouter à un groupe. */
export function addableUsers(users: MessagingUser[], conversation: Pick<Conversation, 'members'>): MessagingUser[] {
  const ids = new Set(conversation.members.map((m) => m.id))
  return users.filter((u) => !ids.has(u.id))
}

/** Entrée seule envoie ; Maj+Entrée va à la ligne. */
export function isSendKey(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing'>): boolean {
  return e.key === 'Enter' && !e.shiftKey && !e.isComposing
}
