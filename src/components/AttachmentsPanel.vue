<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { AttachableType, Document, Link, Note } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { ageLabel, formatDateTime } from '@/utils/clientRequests'
import { documentError, DOCUMENT_EXTENSIONS, fileIcon, fileSize, normalizeUrl } from '@/utils/projects'

/**
 * Notes, liens ou documents d'une fiche (client, projet…).
 * `canAdd` : droit de modifier la fiche ; `canManage` : droit de la supprimer (retire les éléments des autres).
 */
const props = defineProps<{
  kind: 'notes' | 'links' | 'documents'
  type: AttachableType
  id: number
  canAdd: boolean
  canManage: boolean
}>()
const emit = defineEmits<{ changed: [count: number] }>()

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const notes = ref<Note[]>([])
const links = ref<Link[]>([])
const documents = ref<Document[]>([])
const loading = ref(false)
const busy = ref(false)

const noteForm = ref({ body: '', is_pinned: false })
const linkForm = ref({ label: '', url: '' })
const fileInput = ref<HTMLInputElement | null>(null)
const acceptedFiles = DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',')
const editingNote = ref<number | null>(null)
const editingBody = ref('')

const count = computed(() =>
  props.kind === 'notes' ? notes.value.length : props.kind === 'links' ? links.value.length : documents.value.length,
)

async function load(): Promise<void> {
  loading.value = true
  try {
    if (props.kind === 'notes') notes.value = await api.notes.list(props.type, props.id)
    else if (props.kind === 'links') links.value = await api.links.list(props.type, props.id)
    else documents.value = await api.documents.list(props.type, props.id)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    loading.value = false
  }
}

watch(() => [props.kind, props.type, props.id], load, { immediate: true })

function canChange(item: { creator?: { id: number } | null }): boolean {
  return props.canManage || (props.canAdd && item.creator?.id === auth.user?.id)
}

function fail(e: unknown, summary: string): void {
  const detail = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  toast.add({ severity: 'error', summary, detail, life: 5000 })
}

async function run(action: () => Promise<void>, failure: string): Promise<void> {
  busy.value = true
  try {
    await action()
    emit('changed', count.value)
  } catch (e) {
    fail(e, failure)
  } finally {
    busy.value = false
  }
}

function addNote(): Promise<void> {
  return run(async () => {
    if (!noteForm.value.body.trim()) return
    const note = await api.notes.create(props.type, props.id, {
      body: noteForm.value.body.trim(),
      is_pinned: noteForm.value.is_pinned,
      client_uuid: crypto.randomUUID(),
    })
    notes.value = [note, ...notes.value].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
    noteForm.value = { body: '', is_pinned: false }
  }, "Note non enregistrée")
}

function startEdit(note: Note): void {
  editingNote.value = note.id
  editingBody.value = note.body
}

function saveEdit(note: Note): Promise<void> {
  return run(async () => {
    const updated = await api.notes.update(note.id, { body: editingBody.value.trim() })
    notes.value = notes.value.map((n) => (n.id === note.id ? updated : n))
    editingNote.value = null
  }, 'Note non modifiée')
}

function togglePin(note: Note): Promise<void> {
  return run(async () => {
    const updated = await api.notes.update(note.id, { is_pinned: !note.is_pinned })
    notes.value = notes.value
      .map((n) => (n.id === note.id ? updated : n))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
  }, 'Note non modifiée')
}

function addLink(): Promise<void> {
  return run(async () => {
    if (!linkForm.value.url.trim()) return
    const link = await api.links.create(props.type, props.id, {
      label: linkForm.value.label.trim() || null,
      url: normalizeUrl(linkForm.value.url),
      client_uuid: crypto.randomUUID(),
    })
    links.value = [...links.value, link]
    linkForm.value = { label: '', url: '' }
  }, 'Lien non enregistré')
}

function onFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  return run(async () => {
    for (const file of files) {
      const error = documentError(file)
      if (error) {
        toast.add({ severity: 'warn', summary: file.name, detail: error, life: 5000 })
        continue
      }
      const doc = await api.documents.upload(props.type, props.id, file, file.name)
      documents.value = [doc, ...documents.value]
    }
  }, 'Envoi impossible')
}

async function download(doc: Document): Promise<void> {
  try {
    const blob = await api.documents.download(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (e) {
    fail(e, 'Téléchargement impossible')
  }
}

function remove(label: string, action: () => Promise<void>): void {
  confirm.require({
    header: 'Supprimer',
    message: `Supprimer ${label} ?`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => run(action, 'Suppression impossible'),
  })
}

const removeNote = (note: Note) =>
  remove('cette note', async () => {
    await api.notes.remove(note.id)
    notes.value = notes.value.filter((n) => n.id !== note.id)
  })
const removeLink = (link: Link) =>
  remove('ce lien', async () => {
    await api.links.remove(link.id)
    links.value = links.value.filter((l) => l.id !== link.id)
  })
const removeDocument = (doc: Document) =>
  remove(`« ${doc.name} »`, async () => {
    await api.documents.remove(doc.id)
    documents.value = documents.value.filter((d) => d.id !== doc.id)
  })
</script>

<template>
  <div class="panel">
    <!-- Notes -->
    <template v-if="props.kind === 'notes'">
      <form v-if="props.canAdd" class="add" @submit.prevent="addNote">
        <Textarea
          v-model="noteForm.body"
          rows="2"
          auto-resize
          placeholder="Écrire une note… (Ctrl + Entrée pour enregistrer)"
          @keydown.ctrl.enter="addNote"
          @keydown.meta.enter="addNote"
        />
        <div class="add-actions">
          <label class="pin"><Checkbox v-model="noteForm.is_pinned" binary /> Épingler en haut</label>
          <Button type="submit" label="Ajouter la note" icon="pi pi-plus" size="small" :loading="busy" :disabled="!noteForm.body.trim()" />
        </div>
      </form>
      <p v-if="!loading && !notes.length" class="muted">Aucune note.</p>
      <article v-for="note in notes" :key="note.id" class="note" :class="{ pinned: note.is_pinned }">
        <header>
          <span class="muted">
            <i v-if="note.is_pinned" class="pi pi-thumbtack" aria-label="Épinglée" />
            {{ note.creator?.full_name ?? '—' }} · <span :title="formatDateTime(note.created_at)">{{ ageLabel(note.created_at) }}</span>
          </span>
          <span v-if="canChange(note)" class="item-actions">
            <Button icon="pi pi-thumbtack" text rounded size="small" :aria-label="note.is_pinned ? 'Désépingler' : 'Épingler'" @click="togglePin(note)" />
            <Button icon="pi pi-pencil" text rounded size="small" aria-label="Modifier" @click="startEdit(note)" />
            <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="removeNote(note)" />
          </span>
        </header>
        <template v-if="editingNote === note.id">
          <Textarea v-model="editingBody" rows="3" auto-resize class="full" />
          <div class="add-actions end">
            <Button label="Annuler" text size="small" severity="secondary" @click="editingNote = null" />
            <Button label="Enregistrer" size="small" :loading="busy" @click="saveEdit(note)" />
          </div>
        </template>
        <p v-else class="body">{{ note.body }}</p>
      </article>
    </template>

    <!-- Liens -->
    <template v-else-if="props.kind === 'links'">
      <form v-if="props.canAdd" class="add row" @submit.prevent="addLink">
        <InputText v-model="linkForm.label" placeholder="Libellé (facultatif)" class="label" />
        <InputText v-model="linkForm.url" placeholder="https://…" class="grow" />
        <Button type="submit" label="Ajouter" icon="pi pi-plus" size="small" :loading="busy" :disabled="!linkForm.url.trim()" />
      </form>
      <p v-if="!loading && !links.length" class="muted">Aucun lien.</p>
      <div v-for="link in links" :key="link.id" class="line">
        <i class="pi pi-link muted" />
        <a :href="link.url" target="_blank" rel="noopener noreferrer" class="grow">{{ link.label || link.url }}</a>
        <span v-if="link.label" class="muted url">{{ link.url }}</span>
        <Button v-if="canChange(link)" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="removeLink(link)" />
      </div>
    </template>

    <!-- Documents -->
    <template v-else>
      <div v-if="props.canAdd" class="add">
        <Button label="Ajouter des fichiers" icon="pi pi-upload" size="small" :loading="busy" @click="fileInput?.click()" />
        <small class="muted">PDF, images, Office, DWG/DXF, ZIP — 20 Mo par fichier</small>
        <input ref="fileInput" type="file" multiple hidden :accept="acceptedFiles" @change="onFiles" />
      </div>
      <p v-if="!loading && !documents.length" class="muted">Aucun document.</p>
      <div v-for="doc in documents" :key="doc.id" class="line">
        <i :class="fileIcon(doc.name)" class="muted" />
        <button type="button" class="link grow" @click="download(doc)">{{ doc.name }}</button>
        <span class="muted">{{ fileSize(doc.size) }} · {{ doc.creator?.full_name ?? '—' }} · {{ ageLabel(doc.created_at) }}</span>
        <Button v-if="canChange(doc)" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="removeDocument(doc)" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.add {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.add.row {
  flex-direction: row;
  flex-wrap: wrap;
}

.add-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.add-actions.end {
  justify-content: flex-end;
}

.pin {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
}

.label {
  width: 14rem;
}

.grow {
  flex: 1;
  min-width: 0;
}

.full {
  width: 100%;
}

.note {
  padding: 0.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
}

.note.pinned {
  border-color: var(--p-primary-color);
}

.note header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
}

.body {
  margin: 0.375rem 0 0;
  white-space: pre-line;
}

.line {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.url {
  font-size: 0.8rem;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link {
  border: none;
  background: none;
  padding: 0;
  color: var(--p-primary-color);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.link:hover {
  text-decoration: underline;
}
</style>
