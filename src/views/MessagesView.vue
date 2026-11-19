<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Avatar from 'primevue/avatar'
import Badge from 'primevue/badge'
import Dialog from 'primevue/dialog'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, createPoller, filterConversations, lastMessageId, mergeMessages, messageTime, readBy, sameGroup } from '@dash4/shared'
import type { Conversation, Document, Message, MessagingUser } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useMessagingStore } from '@/stores/messaging'
import { addableUsers, isSendKey } from '@/utils/messaging'
import { documentUrl, isImageDocument, openDocuments } from '@/utils/lightbox'
import NewConversationDialog from '@/components/messages/NewConversationDialog.vue'

/** Liste des conversations : toutes les 30 s, seulement onglet affiché. */
const LIST_MS = 30_000

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const messaging = useMessagingStore()
const toast = useToast()
const confirm = useConfirm()
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

const conversations = ref<Conversation[]>([])
const users = ref<MessagingUser[]>([])
const search = ref('')
const messages = ref<Message[]>([])
const hasOlder = ref(false)
const text = ref('')
const files = ref<File[]>([])
const sending = ref(false)
const editingId = ref<number | null>(null)
const editText = ref('')
const urls = ref<Record<number, string>>({})
const scroller = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const newOpen = ref(false)
const membersOpen = ref(false)
const toAdd = ref<number[]>([])
const notifyAsked = ref(typeof Notification === 'undefined' || Notification.permission !== 'default')
// Conversation ouverte : 5 s après un échange, puis 15, 30, 60 s si rien n'arrive ; arrêtée onglet caché
const poller = createPoller(() => poll())
let listTimer: ReturnType<typeof setInterval> | null = null
let syncedAt: string | null = null

const currentId = computed(() => (route.params.id ? Number(route.params.id) : null))
const current = computed(() => conversations.value.find((c) => c.id === currentId.value) ?? null)
const list = computed(() => filterConversations(conversations.value, search.value))
const others = computed(() => current.value?.members.filter((m) => m.id !== auth.user?.id) ?? [])

async function loadList(): Promise<void> {
  const res = await api.messaging.conversations()
  conversations.value = res.data
  messaging.unread = res.meta.unread_total
}

async function openConversation(id: number | null): Promise<void> {
  messages.value = []
  hasOlder.value = false
  editingId.value = null
  if (!id) return
  try {
    const page = await api.messaging.messages(id)
    messages.value = page.data
    syncedAt = page.meta.server_time
    hasOlder.value = page.data.length >= 50
    applyReads(page.meta.reads)
    page.data.forEach(thumbnails)
    await markRead()
    await scrollDown()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Conversation introuvable', detail: errorDetail(e), life: 5000 })
    void router.replace({ name: 'messages' })
  }
}

/** Relève les nouveaux messages ; true s'il y avait du nouveau (le rythme reste rapide). */
async function poll(): Promise<boolean> {
  const id = currentId.value
  if (!id || document.visibilityState !== 'visible') return false
  try {
    const page = await api.messaging.messages(id, { after_id: lastMessageId(messages.value), updated_since: syncedAt ?? undefined })
    if (id !== currentId.value) return false
    syncedAt = page.meta.server_time
    applyReads(page.meta.reads)
    if (page.data.length) {
      const atBottom = isAtBottom()
      messages.value = mergeMessages(messages.value, page.data)
      page.data.forEach(thumbnails)
      await markRead()
      if (atBottom) await scrollDown()
    }
    return page.data.length > 0
  } catch {
    // réseau : on réessaiera, plus lentement
    return false
  }
}

async function loadOlder(): Promise<void> {
  if (!currentId.value || !messages.value.length) return
  const page = await api.messaging.messages(currentId.value, { before_id: messages.value[0]!.id })
  hasOlder.value = page.data.length >= 50
  messages.value = mergeMessages(messages.value, page.data)
  page.data.forEach(thumbnails)
}

function applyReads(reads: { user_id: number; last_read_message_id: number | null }[]): void {
  const c = current.value
  if (!c) return
  for (const r of reads) {
    const m = c.members.find((x) => x.id === r.user_id)
    if (m) m.last_read_message_id = r.last_read_message_id
  }
}

async function markRead(): Promise<void> {
  const c = current.value
  if (!c || document.visibilityState !== 'visible') return
  if (c.unread_count === 0 && messaging.unread === 0) return
  messaging.unread = await api.messaging.read(c.id).catch(() => messaging.unread)
  c.unread_count = 0
}

function isAtBottom(): boolean {
  const el = scroller.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80
}
async function scrollDown(): Promise<void> {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

function thumbnails(m: Message): void {
  for (const d of m.files) {
    if (isImageDocument(d) && !urls.value[d.id]) {
      void documentUrl(d).then((u) => (urls.value = { ...urls.value, [d.id]: u })).catch(() => undefined)
    }
  }
}
async function openFile(d: Document, all: Document[]): Promise<void> {
  if (isImageDocument(d)) return openDocuments(all, d)
  const url = URL.createObjectURL(await api.documents.download(d))
  const a = document.createElement('a')
  a.href = url
  a.download = d.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function send(): Promise<void> {
  const c = current.value
  const body = text.value.trim()
  if (!c || (!body && !files.value.length) || sending.value) return
  sending.value = true
  try {
    let message = await api.messaging.send(c.id, { body: body || null, with_files: files.value.length > 0, client_uuid: crypto.randomUUID() })
    if (files.value.length) {
      const uploaded: Document[] = []
      for (const f of files.value) uploaded.push(await api.documents.upload('messages', message.id, f, f.name))
      message = { ...message, files: uploaded }
    }
    text.value = ''
    files.value = []
    messages.value = mergeMessages(messages.value, [message])
    thumbnails(message)
    c.last_message = { id: message.id, excerpt: body || 'Fichier', author: message.author ?? null, created_at: message.created_at }
    c.last_message_at = message.created_at
    poller.poke()
    await scrollDown()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Message non envoyé', detail: errorDetail(e), life: 5000 })
  } finally {
    sending.value = false
  }
}
function onKeydown(e: KeyboardEvent): void {
  if (isSendKey(e)) {
    e.preventDefault()
    void send()
  }
}
function onFiles(e: Event): void {
  files.value = [...files.value, ...Array.from((e.target as HTMLInputElement).files ?? [])]
  if (fileInput.value) fileInput.value.value = ''
}

function startEdit(m: Message): void {
  editingId.value = m.id
  editText.value = m.body ?? ''
}
async function saveEdit(m: Message): Promise<void> {
  if (!editText.value.trim()) return
  try {
    messages.value = mergeMessages(messages.value, [await api.messaging.edit(m.id, editText.value)])
    editingId.value = null
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
  }
}
function removeMessage(m: Message): void {
  confirm.require({
    header: 'Supprimer le message',
    message: 'Le message et ses fichiers disparaîtront pour tout le monde.',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.messaging.remove(m.id)
      messages.value = messages.value.map((x) => (x.id === m.id ? { ...x, body: null, files: [], deleted_at: new Date().toISOString(), can: { update: false } } : x))
    },
  })
}

function onCreated(c: Conversation): void {
  conversations.value = [c, ...conversations.value.filter((x) => x.id !== c.id)]
  void router.push({ name: 'messages', params: { id: c.id } })
}

async function rename(): Promise<void> {
  const c = current.value
  if (!c) return
  const title = window.prompt('Nom du groupe', c.title)?.trim()
  if (!title || title === c.title) return
  replace(await api.messaging.rename(c.id, title))
}
async function addMembers(): Promise<void> {
  const c = current.value
  if (!c || !toAdd.value.length) return
  replace(await api.messaging.addMembers(c.id, toAdd.value))
  toAdd.value = []
}
async function removeMember(userId: number): Promise<void> {
  const c = current.value
  if (!c) return
  await api.messaging.removeMember(c.id, userId)
  if (userId === auth.user?.id) {
    membersOpen.value = false
    conversations.value = conversations.value.filter((x) => x.id !== c.id)
    void router.push({ name: 'messages' })
  } else {
    replace(await api.messaging.get(c.id))
  }
}
function leave(): void {
  confirm.require({
    header: 'Quitter la conversation',
    message: 'Vous ne recevrez plus ses messages.',
    acceptProps: { label: 'Quitter', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => removeMember(auth.user!.id),
  })
}
function replace(c: Conversation): void {
  conversations.value = conversations.value.map((x) => (x.id === c.id ? c : x))
}

async function askNotifications(): Promise<void> {
  if (typeof Notification !== 'undefined') await Notification.requestPermission()
  notifyAsked.value = true
}

const initials = (name: string) => name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()
const isMine = (m: Message) => m.user_id === auth.user?.id
const seenBy = (m: Message) => (current.value && isMine(m) ? readBy(m, current.value.members) : [])
const lastMineId = computed(() => [...messages.value].reverse().find((m) => isMine(m) && !m.deleted_at)?.id ?? null)

watch(currentId, (id) => {
  void openConversation(id)
  poller.poke()
})

function onVisible(): void {
  if (document.visibilityState === 'visible') {
    poller.start()
    void loadList().catch(() => undefined)
    void markRead()
  } else {
    poller.stop()
  }
}

onMounted(async () => {
  await Promise.all([loadList(), api.messaging.users().then((u) => (users.value = u))])
  if (currentId.value) await openConversation(currentId.value)
  else if (route.query.project) {
    // Depuis un projet : sa discussion si j'en fais partie, sinon on en crée une
    const existing = conversations.value.find((c) => c.project?.id === Number(route.query.project))
    if (existing) void router.replace({ name: 'messages', params: { id: existing.id } })
    else newOpen.value = true
  }
  if (document.visibilityState === 'visible') poller.start()
  listTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void loadList().catch(() => undefined)
  }, LIST_MS)
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
  poller.stop()
  if (listTimer) clearInterval(listTimer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <div class="messenger">
    <aside class="list" :class="{ hidden: currentId }">
      <div class="list-head">
        <h1>Messages</h1>
        <Button icon="pi pi-pen-to-square" rounded aria-label="Nouvelle conversation" title="Nouvelle conversation" @click="newOpen = true" />
      </div>
      <InputText v-model="search" placeholder="Rechercher…" fluid />
      <button v-if="!notifyAsked" type="button" class="notify" @click="askNotifications">
        <i class="pi pi-bell" /> Être prévenu des nouveaux messages
      </button>
      <p v-if="!list.length" class="muted empty">Aucune conversation.</p>
      <button
        v-for="c in list"
        :key="c.id"
        type="button"
        class="conv"
        :class="{ active: c.id === currentId, unread: c.unread_count > 0 }"
        @click="router.push({ name: 'messages', params: { id: c.id } })"
      >
        <Avatar
          v-if="c.type === 'direct'"
          :image="c.members.find((m) => m.id !== auth.user?.id)?.avatar_url ?? undefined"
          :label="c.members.find((m) => m.id !== auth.user?.id)?.avatar_url ? undefined : initials(c.title)"
          shape="circle"
        />
        <Avatar v-else icon="pi pi-users" shape="circle" />
        <span class="conv-text">
          <span class="conv-title">{{ c.title }}</span>
          <span class="conv-last">{{ c.last_message ? (c.type === 'group' && c.last_message.author ? `${c.last_message.author.full_name.split(' ')[0]} : ` : '') + c.last_message.excerpt : c.project?.name ?? 'Nouvelle conversation' }}</span>
        </span>
        <span class="conv-side">
          <span class="muted small">{{ messageTime(c.last_message_at) }}</span>
          <Badge v-if="c.unread_count" :value="c.unread_count" />
        </span>
      </button>
    </aside>

    <section v-if="current" class="thread">
      <header class="thread-head">
        <Button icon="pi pi-arrow-left" text rounded class="back" aria-label="Retour" @click="router.push({ name: 'messages' })" />
        <div class="thread-title">
          <strong>{{ current.title }}</strong>
          <span class="muted small">
            <template v-if="current.type === 'group'">{{ current.members.length }} participants</template>
            <template v-else>{{ others[0]?.job_title }}</template>
            <RouterLink v-if="current.project" :to="{ name: 'project', params: { id: current.project.id } }"> · {{ current.project.name }}</RouterLink>
            <RouterLink v-if="current.task" :to="{ name: 'task', params: { id: current.task.id } }"> · {{ current.task.title }}</RouterLink>
          </span>
        </div>
        <Button v-if="current.type === 'group'" icon="pi pi-users" text rounded aria-label="Participants" title="Participants" @click="membersOpen = true" />
      </header>

      <div ref="scroller" class="messages">
        <div v-if="hasOlder" class="older"><Button label="Messages précédents" text size="small" @click="loadOlder" /></div>
        <template v-for="(m, i) in messages" :key="m.id">
          <div class="msg" :class="{ mine: isMine(m), grouped: sameGroup(messages[i - 1], m) }">
            <span v-if="!isMine(m) && current.type === 'group' && !sameGroup(messages[i - 1], m)" class="author">{{ m.author?.full_name }}</span>
            <div class="bubble" :class="{ deleted: m.deleted_at }">
              <template v-if="m.deleted_at"><i class="pi pi-ban" /> Message supprimé</template>
              <template v-else-if="editingId === m.id">
                <Textarea v-model="editText" auto-resize rows="2" fluid @keydown.enter.exact.prevent="saveEdit(m)" @keydown.esc="editingId = null" />
                <div class="edit-actions">
                  <Button label="Annuler" text size="small" @click="editingId = null" />
                  <Button label="Enregistrer" size="small" @click="saveEdit(m)" />
                </div>
              </template>
              <template v-else>
                <p v-if="m.body" class="body">{{ m.body }}</p>
                <div v-if="m.files.length" class="files">
                  <button v-for="d in m.files" :key="d.id" type="button" class="file" :title="d.name" @click="openFile(d, m.files)">
                    <img v-if="urls[d.id]" :src="urls[d.id]" :alt="d.name" />
                    <template v-else><i class="pi pi-paperclip" /> {{ d.name }}</template>
                  </button>
                </div>
              </template>
              <span class="meta">
                {{ messageTime(m.created_at) }}<template v-if="m.edited_at"> · modifié</template>
                <span v-if="m.can.update && editingId !== m.id" class="actions">
                  <i class="pi pi-pencil" role="button" aria-label="Modifier" title="Modifier" @click="startEdit(m)" />
                  <i class="pi pi-trash" role="button" aria-label="Supprimer" title="Supprimer" @click="removeMessage(m)" />
                </span>
              </span>
            </div>
            <span v-if="m.id === lastMineId && seenBy(m).length" class="seen muted small">
              Vu{{ current.type === 'group' ? ` par ${seenBy(m).join(', ')}` : '' }}
            </span>
          </div>
        </template>
        <p v-if="!messages.length" class="muted empty">Écrivez le premier message.</p>
      </div>

      <footer class="composer">
        <div v-if="files.length" class="pending">
          <Tag v-for="(f, i) in files" :key="i" severity="secondary">
            {{ f.name }} <i class="pi pi-times" role="button" aria-label="Retirer" @click="files.splice(i, 1)" />
          </Tag>
        </div>
        <div class="row">
          <Button icon="pi pi-paperclip" text rounded aria-label="Joindre un fichier" title="Joindre un fichier" @click="fileInput?.click()" />
          <input ref="fileInput" type="file" multiple hidden @change="onFiles" />
          <Textarea v-model="text" auto-resize rows="1" fluid placeholder="Votre message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)" @keydown="onKeydown" />
          <Button icon="pi pi-send" rounded aria-label="Envoyer" :loading="sending" :disabled="!text.trim() && !files.length" @click="send" />
        </div>
      </footer>
    </section>
    <section v-else class="thread placeholder">
      <i class="pi pi-comments" />
      <p class="muted">Choisissez une conversation ou démarrez-en une.</p>
    </section>

    <NewConversationDialog v-model:visible="newOpen" :users="users" :project-id="route.query.project ? Number(route.query.project) : null" @created="onCreated" />

    <Dialog v-model:visible="membersOpen" modal header="Participants" :style="{ width: '26rem' }">
      <template v-if="current">
        <div v-if="current.can.manage" class="rename">
          <span>{{ current.title }}</span>
          <Button label="Renommer" text size="small" icon="pi pi-pencil" @click="rename" />
        </div>
        <div v-for="m in current.members" :key="m.id" class="member">
          <Avatar :image="m.avatar_url ?? undefined" :label="m.avatar_url ? undefined : initials(m.full_name)" shape="circle" />
          <span class="member-name">{{ m.full_name }}<span v-if="m.job_title" class="muted small"> — {{ m.job_title }}</span></span>
          <Button v-if="current.can.manage && m.id !== auth.user?.id" icon="pi pi-times" text rounded severity="danger" aria-label="Retirer" @click="removeMember(m.id)" />
        </div>
        <div v-if="current.can.manage" class="add">
          <MultiSelect v-model="toAdd" :options="addableUsers(users, current)" option-label="full_name" option-value="id" filter placeholder="Ajouter des personnes" class="grow" />
          <Button label="Ajouter" :disabled="!toAdd.length" @click="addMembers" />
        </div>
        <Button label="Quitter la conversation" severity="danger" text icon="pi pi-sign-out" class="leave" @click="leave" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.messenger {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: calc(100vh - 7rem);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--p-content-background);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-right: 1px solid var(--p-content-border-color);
  overflow-y: auto;
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.list-head h1 {
  font-size: 1.25rem;
  margin: 0;
}
.notify {
  background: var(--p-primary-50);
  color: var(--p-primary-700);
  border: none;
  border-radius: 6px;
  padding: 0.5rem;
  cursor: pointer;
  text-align: left;
}
.conv {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem;
  border: none;
  border-radius: 8px;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.conv:hover,
.conv.active {
  background: var(--p-content-hover-background);
}
.conv-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.conv-title,
.conv-last {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv.unread .conv-title,
.conv.unread .conv-last {
  font-weight: 600;
}
.conv-last {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}
.conv-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}
.thread {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.placeholder {
  align-items: center;
  justify-content: center;
}
.placeholder .pi {
  font-size: 3rem;
  color: var(--p-text-muted-color);
}
.thread-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color);
}
.thread-title {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.back {
  display: none;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.older {
  text-align: center;
}
.msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 0.5rem;
}
.msg.grouped {
  margin-top: 0;
}
.msg.mine {
  align-items: flex-end;
}
.author {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin: 0 0 0.125rem 0.5rem;
}
.bubble {
  max-width: min(70%, 560px);
  padding: 0.5rem 0.75rem;
  border-radius: 14px;
  background: var(--p-content-hover-background);
}
.mine .bubble {
  background: var(--p-primary-100);
  color: var(--p-primary-900);
}
.bubble.deleted {
  font-style: italic;
  color: var(--p-text-muted-color);
  background: none;
  border: 1px dashed var(--p-content-border-color);
}
.body {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.meta {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  margin-top: 0.125rem;
}
.actions {
  display: none;
  gap: 0.5rem;
  cursor: pointer;
}
.bubble:hover .actions {
  display: inline-flex;
}
.edit-actions {
  display: flex;
  justify-content: flex-end;
}
.files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.25rem;
}
.file {
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  background: var(--p-content-background);
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: inherit;
}
.file img {
  display: block;
  max-height: 160px;
  max-width: 220px;
}
.seen {
  margin-top: 0.125rem;
}
.composer {
  border-top: 1px solid var(--p-content-border-color);
  padding: 0.5rem 0.75rem;
}
.composer .row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}
.pending {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-bottom: 0.375rem;
}
.empty {
  text-align: center;
  margin: 2rem 0;
}
.small {
  font-size: 0.8rem;
}
.member,
.rename,
.add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
}
.member-name,
.grow {
  flex: 1;
}
.rename {
  justify-content: space-between;
  font-weight: 600;
}
.leave {
  margin-top: 0.75rem;
}
@media (max-width: 800px) {
  .messenger {
    grid-template-columns: 1fr;
  }
  .list.hidden {
    display: none;
  }
  .thread.placeholder {
    display: none;
  }
  .back {
    display: inline-flex;
  }
}
</style>
