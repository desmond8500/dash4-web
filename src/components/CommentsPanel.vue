<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, nextTick, ref, watch } from 'vue'
import Button from 'primevue/button'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, filterMentionable, insertMention, mentionedIds, mentionQuery } from '@dash4/shared'
import type { Comment, CommentableType, Document, Mentionable } from '@dash4/shared'
import { api } from '@/services/api'
import { formatDateTime } from '@/utils/clientRequests'
import { documentUrl, openDocuments } from '@/utils/lightbox'

/**
 * Fil de commentaires d'une fiche : écrire, mentionner avec @ (la personne est prévenue),
 * joindre des fichiers, modifier ou supprimer ses commentaires.
 */
const props = defineProps<{ type: CommentableType; id: number }>()
const emit = defineEmits<{ changed: [count: number] }>()
const toast = useToast()
const confirm = useConfirm()

const comments = ref<Comment[]>([])
const people = ref<Mentionable[]>([])
const loading = ref(false)
const sending = ref(false)
const text = ref('')
const files = ref<File[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const editor = ref<{ $el: HTMLElement } | null>(null)
const editingId = ref<number | null>(null)
const editText = ref('')
const urls = ref<Record<number, string>>({})

// Suggestions de mention
const mention = ref<{ start: number; query: string } | null>(null)
const highlighted = ref(0)
const suggestions = computed(() => (mention.value ? filterMentionable(people.value, mention.value.query) : []))

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
const isImage = (d: Document) => (d.mime_type ?? '').startsWith('image/')
const allPeople = computed(() => {
  const map = new Map<number, { id: number; full_name: string }>()
  for (const p of people.value) map.set(p.id, p)
  for (const c of comments.value) for (const m of c.mentions ?? []) map.set(m.id, m)
  return [...map.values()]
})
const mentionNames = (c: Comment) => (c.mentions ?? []).map((p) => p.full_name)

async function load(): Promise<void> {
  loading.value = true
  try {
    comments.value = (await api.comments.list(props.type, props.id)).data
    emit('changed', comments.value.length)
    comments.value.flatMap((c) => c.files ?? []).forEach((d) => void thumbnail(d))
    people.value = await api.comments.mentionable(props.type, props.id).catch(() => [])
  } finally {
    loading.value = false
  }
}
watch(() => [props.type, props.id], load, { immediate: true })

async function thumbnail(d: Document): Promise<void> {
  if (!isImage(d) || urls.value[d.id]) return
  const url = await documentUrl(d).catch(() => null)
  if (url) urls.value = { ...urls.value, [d.id]: url }
}
async function openFile(d: Document, all: Document[]): Promise<void> {
  if (isImage(d)) return openDocuments(all, d)
  const url = URL.createObjectURL(await api.documents.download(d))
  const a = document.createElement('a')
  a.href = url
  a.download = d.name
  a.click()
}

function textarea(): HTMLTextAreaElement | null {
  return editor.value?.$el.querySelector('textarea') ?? null
}
function onInput(): void {
  const el = textarea()
  mention.value = el ? mentionQuery(text.value, el.selectionStart ?? text.value.length) : null
  highlighted.value = 0
}
async function pick(person: Mentionable): Promise<void> {
  const el = textarea()
  if (!mention.value || !el) return
  const result = insertMention(text.value, mention.value.start, el.selectionStart ?? text.value.length, person)
  text.value = result.text
  mention.value = null
  await nextTick()
  el.focus()
  el.setSelectionRange(result.cursor, result.cursor)
}
function onKeydown(e: KeyboardEvent): void {
  if (suggestions.value.length) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = suggestions.value.length
      highlighted.value = (highlighted.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      void pick(suggestions.value[highlighted.value]!)
      return
    }
    if (e.key === 'Escape') {
      mention.value = null
      return
    }
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void send()
  }
}

function onBlur(): void {
  // Laisse le temps de cliquer une suggestion
  setTimeout(() => (mention.value = null), 150)
}
function onFiles(e: Event): void {
  files.value = [...files.value, ...Array.from((e.target as HTMLInputElement).files ?? [])]
  if (fileInput.value) fileInput.value.value = ''
}

async function send(): Promise<void> {
  const body = text.value.trim()
  if (!body && !files.value.length) return
  sending.value = true
  try {
    let comment = await api.comments.create(props.type, props.id, {
      client_uuid: crypto.randomUUID(),
      body: body || 'Fichier joint',
      mentions: mentionedIds(body, people.value),
    })
    if (files.value.length) {
      const uploaded: Document[] = []
      for (const f of files.value) uploaded.push(await api.documents.upload('comments', comment.id, f, f.name))
      comment = { ...comment, files: [...(comment.files ?? []), ...uploaded] }
      uploaded.forEach((d) => void thumbnail(d))
    }
    comments.value = [...comments.value, comment]
    emit('changed', comments.value.length)
    text.value = ''
    files.value = []
    if (comment.mentions?.length) toast.add({ severity: 'info', summary: 'Mention envoyée', detail: comment.mentions.map((m) => m.full_name).join(', '), life: 3000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Envoi impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    sending.value = false
  }
}

function startEdit(c: Comment): void {
  editingId.value = c.id
  editText.value = c.body
}
async function saveEdit(c: Comment): Promise<void> {
  const body = editText.value.trim()
  if (!body) return
  try {
    const updated = await api.comments.update(c.id, { body, mentions: mentionedIds(body, allPeople.value) })
    comments.value = comments.value.map((x) => (x.id === c.id ? updated : x))
    editingId.value = null
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
  }
}
function remove(c: Comment): void {
  confirm.require({
    header: 'Supprimer le commentaire',
    message: 'Supprimer ce commentaire et ses fichiers ?',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.comments.remove(c.id)
      comments.value = comments.value.filter((x) => x.id !== c.id)
      emit('changed', comments.value.length)
    },
  })
}
</script>

<template>
  <div class="comments">
    <p v-if="!loading && !comments.length" class="muted">Aucun commentaire. Tapez @ pour mentionner quelqu'un : il sera prévenu.</p>
    <article v-for="c in comments" :key="c.id" class="comment">
      <header>
        <strong>{{ c.author?.full_name ?? '—' }}</strong>
        <span class="muted small">{{ formatDateTime(c.created_at) }}<template v-if="c.edited_at"> · modifié</template></span>
        <span class="grow" />
        <Button v-if="c.can.update && editingId !== c.id" icon="pi pi-pencil" text rounded size="small" severity="secondary" aria-label="Modifier" @click="startEdit(c)" />
        <Button v-if="c.can.delete" icon="pi pi-trash" text rounded size="small" severity="secondary" aria-label="Supprimer" @click="remove(c)" />
      </header>
      <div v-if="editingId === c.id" class="edit">
        <MarkdownEditor v-model="editText" rows="2" auto-resize fluid />
        <div class="row">
          <Button label="Annuler" size="small" text severity="secondary" @click="editingId = null" />
          <Button label="Enregistrer" size="small" @click="saveEdit(c)" />
        </div>
      </div>
      <MarkdownView v-else class="body" :text="c.body" :mentions="mentionNames(c)" />
      <div v-if="c.files?.length" class="files">
        <button v-for="d in c.files" :key="d.id" type="button" class="file" :title="d.name" @click="openFile(d, c.files ?? [])">
          <img v-if="urls[d.id]" :src="urls[d.id]" :alt="d.name" />
          <template v-else><i class="pi pi-paperclip" /> {{ d.name }}</template>
        </button>
      </div>
    </article>

    <div class="composer">
      <div class="input-wrap">
        <MarkdownEditor ref="editor" v-model="text" rows="2" auto-resize fluid placeholder="Écrire un commentaire… (@ pour mentionner, Ctrl+Entrée pour envoyer)" @input="onInput" @click="onInput" @keydown="onKeydown" @blur="onBlur" />
        <ul v-if="suggestions.length" class="suggestions" role="listbox">
          <li v-for="(p, i) in suggestions" :key="p.id" :class="{ active: i === highlighted }" role="option" @mousedown.prevent="pick(p)">
            {{ p.full_name }}<small v-if="p.job_title" class="muted"> · {{ p.job_title }}</small>
          </li>
        </ul>
      </div>
      <div v-if="files.length" class="pending-files">
        <span v-for="(f, i) in files" :key="i" class="chip">{{ f.name }} <i class="pi pi-times" role="button" aria-label="Retirer" @click="files.splice(i, 1)" /></span>
      </div>
      <div class="row">
        <input ref="fileInput" type="file" multiple hidden @change="onFiles" />
        <Button icon="pi pi-paperclip" text severity="secondary" aria-label="Joindre des fichiers" @click="fileInput?.click()" />
        <span class="grow" />
        <Button label="Envoyer" icon="pi pi-send" size="small" :loading="sending" :disabled="!text.trim() && !files.length" @click="send" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.comments {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.comment {
  border-bottom: 1px solid var(--p-content-border-color);
  padding-bottom: 0.5rem;
}

.comment header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.body {
  margin: 0.25rem 0 0;
}

.mention {
  color: var(--p-primary-color);
  font-weight: 600;
}

.files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.file {
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  background: none;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: inherit;
}

.file img {
  display: block;
  max-height: 90px;
  max-width: 140px;
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.input-wrap {
  position: relative;
}

.suggestions {
  position: absolute;
  z-index: 10;
  left: 0;
  top: 100%;
  min-width: 240px;
  margin: 0.25rem 0 0;
  padding: 0.25rem 0;
  list-style: none;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
}

.suggestions li {
  padding: 0.375rem 0.75rem;
  cursor: pointer;
}

.suggestions li.active,
.suggestions li:hover {
  background: var(--p-content-hover-background);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.8rem;
}

.pending-files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.chip {
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.85rem;
}

.chip i {
  cursor: pointer;
  font-size: 0.7rem;
}
</style>
