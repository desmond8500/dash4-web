<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { ApiError, PRIORITY_LABELS } from '@dash4/shared'
import type { InboundEmail, InboundEmailMeta, Priority } from '@dash4/shared'
import { api } from '@/services/api'
import { formatDateTime } from '@/utils/clientRequests'
import ClientPicker, { type ClientOption } from '@/components/ClientPicker.vue'

/**
 * Boîte mail des demandes : e-mails reçus sur l'adresse dédiée (relevée toutes les 5 minutes),
 * à transformer en demande client ou à ignorer.
 */
const toast = useToast()
const router = useRouter()
type Status = 'new' | 'converted' | 'ignored'
const status = ref<Status>('new')
const search = ref('')
const emails = ref<InboundEmail[]>([])
const meta = ref<InboundEmailMeta | null>(null)
const selected = ref<InboundEmail | null>(null)
const loading = ref(false)
const fetching = ref(false)

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.inbox.list({ status: status.value, search: search.value || undefined })
    emails.value = result.data
    meta.value = result.meta
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(load, 300)
})
watch(status, () => {
  selected.value = null
  void load()
})
onMounted(load)

async function open(e: InboundEmail): Promise<void> {
  selected.value = await api.inbox.get(e.id).catch(() => e)
}
async function fetchNow(): Promise<void> {
  fetching.value = true
  try {
    const r = await api.inbox.fetch()
    toast.add({ severity: 'success', summary: r.imported ? `${r.imported} nouvel(s) e-mail(s)` : 'Aucun nouvel e-mail', life: 3000 })
    if (r.failed) {
      toast.add({ severity: 'warn', summary: `${r.failed} e-mail(s) illisible(s)`, detail: 'Laissé(s) non lu(s) dans la boîte mail : ouvrez-le(s) dans votre messagerie.', life: 8000 })
    }
    void load()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Relevé impossible', detail: errorDetail(e), life: 6000 })
  } finally {
    fetching.value = false
  }
}
async function ignore(restore = false): Promise<void> {
  if (!selected.value) return
  await api.inbox.ignore(selected.value.id, restore)
  selected.value = null
  void load()
}
async function download(index: number, name: string): Promise<void> {
  const url = URL.createObjectURL(await api.inbox.attachment(selected.value!.id, index))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

// Transformer en demande
const convertOpen = ref(false)
const convert = ref({ body: '', priority: 'normal' as Priority, client: null as ClientOption | null })
const priorities = (Object.entries(PRIORITY_LABELS) as Array<[Priority, string]>).map(([value, label]) => ({ value, label }))
const converting = ref(false)
function openConvert(): void {
  const e = selected.value!
  convert.value = { body: `${e.subject}\n\n${(e.body_text ?? '').slice(0, 4000)}`.trim(), priority: 'normal', client: e.client }
  convertOpen.value = true
}
async function doConvert(): Promise<void> {
  converting.value = true
  try {
    const client = convert.value.client && typeof convert.value.client === 'object' ? convert.value.client : null
    const result = await api.inbox.convert(selected.value!.id, { body: convert.value.body.trim(), priority: convert.value.priority, client_id: client?.id ?? null })
    convertOpen.value = false
    selected.value = null
    void load()
    void router.push({ name: 'client-requests', query: { demande: result.request.id } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Transformation impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    converting.value = false
  }
}
const size = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`)
const from = (e: InboundEmail) => e.from_name ?? e.from_email ?? 'Expéditeur inconnu'
const statusOptions = computed(() => [
  { value: 'new', label: `Nouveaux${meta.value?.new_count ? ` (${meta.value.new_count})` : ''}` },
  { value: 'converted', label: 'Transformés' },
  { value: 'ignored', label: 'Ignorés' },
])
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'client-requests' }" class="back"><i class="pi pi-arrow-left" /> Demandes</RouterLink>
    <div class="page-header">
      <h1>Boîte mail des demandes</h1>
      <Button label="Relever maintenant" icon="pi pi-refresh" severity="secondary" :loading="fetching" :disabled="meta?.configured === false" @click="fetchNow" />
    </div>
    <Message v-if="meta && !meta.configured" severity="warn" :closable="false">
      La boîte mail n'est pas encore configurée sur le serveur : voir docs/DEPLOIEMENT.md, section 7 (INBOX_HOST, INBOX_USERNAME, INBOX_PASSWORD).
    </Message>
    <p v-else-if="meta?.address" class="muted small">
      Les e-mails envoyés à <strong>{{ meta.address }}</strong> arrivent ici (relevé toutes les 5 minutes).
    </p>

    <div class="filters">
      <SelectButton v-model="status" :options="statusOptions" option-label="label" option-value="value" :allow-empty="false" />
      <InputText v-model="search" placeholder="Objet, expéditeur" />
    </div>

    <div class="mailbox">
      <div class="list">
        <button v-for="e in emails" :key="e.id" type="button" class="item" :class="{ active: selected?.id === e.id }" @click="open(e)">
          <span class="row"><strong>{{ from(e) }}</strong><small class="muted">{{ formatDateTime(e.received_at) }}</small></span>
          <span class="subject">{{ e.subject }}<i v-if="e.attachments.length" class="pi pi-paperclip muted" /></span>
          <small class="muted">{{ e.preview }}</small>
          <Tag v-if="e.client" :value="e.client.name" severity="info" class="client" />
        </button>
        <p v-if="!emails.length && !loading" class="muted empty">Aucun e-mail.</p>
      </div>

      <div v-if="selected" class="reader">
        <div class="reader-head">
          <h2>{{ selected.subject }}</h2>
          <p class="muted">
            De <strong>{{ from(selected) }}</strong><template v-if="selected.from_name"> &lt;{{ selected.from_email }}&gt;</template>
            · {{ formatDateTime(selected.received_at) }}
          </p>
          <p v-if="selected.client"><i class="pi pi-building" /> Client reconnu : <RouterLink :to="{ name: 'client', params: { id: selected.client.id } }">{{ selected.client.name }}</RouterLink></p>
          <div class="actions">
            <template v-if="selected.status.value === 'new'">
              <Button label="Transformer en demande" icon="pi pi-inbox" @click="openConvert" />
              <Button label="Ignorer" icon="pi pi-eye-slash" severity="secondary" outlined @click="ignore()" />
            </template>
            <Button v-else-if="selected.status.value === 'ignored'" label="Remettre dans les nouveaux" icon="pi pi-replay" severity="secondary" @click="ignore(true)" />
            <Button
              v-else-if="selected.client_request_id"
              label="Ouvrir la demande"
              icon="pi pi-external-link"
              severity="secondary"
              @click="router.push({ name: 'client-requests', query: { demande: selected.client_request_id } })"
            />
          </div>
        </div>
        <div v-if="selected.attachments.length" class="attachments">
          <Button v-for="a in selected.attachments" :key="a.index" :label="`${a.name} (${size(a.size)})`" icon="pi pi-paperclip" text size="small" @click="download(a.index, a.name)" />
        </div>
        <pre class="body">{{ selected.body_text || '(message vide)' }}</pre>
      </div>
      <div v-else class="reader muted placeholder">Choisissez un e-mail à lire.</div>
    </div>

    <Dialog v-model:visible="convertOpen" header="Transformer en demande" modal :style="{ width: '560px' }" :breakpoints="{ '600px': '95vw' }">
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label for="c-client">Client</label>
          <ClientPicker v-model="convert.client" input-id="c-client" placeholder="Pas encore client" />
        </div>
        <div class="form-field form-field--full">
          <label>Priorité</label>
          <SelectButton v-model="convert.priority" :options="priorities" option-label="label" option-value="value" :allow-empty="false" />
        </div>
        <div class="form-field form-field--full">
          <label for="c-body">Demande</label>
          <MarkdownEditor id="c-body" v-model="convert.body" rows="8" auto-resize />
        </div>
        <p class="form-field--full muted small">Les pièces jointes deviennent des documents de la demande. Vous pourrez ensuite la lier à des tâches, factures ou bordereaux.</p>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="convertOpen = false" />
        <Button label="Créer la demande" icon="pi pi-check" :loading="converting" :disabled="!convert.body.trim()" @click="doConvert" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.mailbox {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

@media (max-width: 900px) {
  .mailbox {
    grid-template-columns: 1fr;
  }
}

.list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  overflow: hidden;
  max-height: 70vh;
  overflow-y: auto;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.625rem 0.75rem;
  border: 0;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item.active {
  background: var(--p-content-hover-background);
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.subject i {
  margin-left: 0.375rem;
}

.client {
  align-self: flex-start;
  margin-top: 0.25rem;
}

.empty {
  padding: 1rem;
}

.reader {
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  padding: 1rem;
  background: var(--p-content-background);
  min-width: 0;
}

.placeholder {
  text-align: center;
  padding: 3rem 1rem;
}

.reader-head h2 {
  margin: 0 0 0.25rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 0.5rem 0;
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 0.5rem;
}

.body {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 0.75rem;
  margin: 0.5rem 0 0;
}

.small {
  font-size: 0.85rem;
}
</style>
