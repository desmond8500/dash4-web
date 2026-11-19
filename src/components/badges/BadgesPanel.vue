<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, parseBadgeList } from '@dash4/shared'
import type { Badge, BadgePayload, BadgeTemplate } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import BadgeTemplatesDialog from './BadgeTemplatesDialog.vue'

/** Badges des personnes d'un projet : saisie, import d'une liste, photos, impression (cartes ou planche A4). */
const props = defineProps<{ projectId: number; clientId: number | null }>()
const emit = defineEmits<{ count: [n: number] }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const badges = ref<Badge[]>([])
const templates = ref<BadgeTemplate[]>([])
const templateId = ref<number | null>(null)
const selected = ref<number[]>([])
const templatesOpen = ref(false)
const editOpen = ref(false)
const importOpen = ref(false)
const importText = ref('')
const editing = ref<Badge | null>(null)
const form = ref<BadgePayload & { valid: Date | null }>({ valid: null })
const error = ref<string | null>(null)
const printing = ref(false)

const preview = computed(() => parseBadgeList(importText.value))
const allSelected = computed({
  get: () => badges.value.length > 0 && selected.value.length === badges.value.length,
  set: (v: boolean) => (selected.value = v ? badges.value.map((b) => b.id) : []),
})
const templateName = (id: number | null) => templates.value.find((t) => t.id === id)?.name ?? '—'
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  const [b, t] = await Promise.all([api.badges.list(props.projectId), api.badges.templates(props.clientId ?? undefined).catch(() => [])])
  badges.value = b
  templates.value = t
  templateId.value ??= t[0]?.id ?? null
  emit('count', b.length)
}
watch(() => props.projectId, load, { immediate: true })

function edit(b: Badge | null): void {
  editing.value = b
  error.value = null
  form.value = b
    ? { firstname: b.firstname, lastname: b.lastname, job_title: b.job_title, department: b.department, division: b.division, employee_number: b.employee_number, address: b.address, badge_template_id: b.badge_template_id, valid: fromApiDate(b.valid_until) }
    : { badge_template_id: templateId.value, valid: null }
  editOpen.value = true
}
async function save(): Promise<void> {
  const { valid, ...rest } = form.value
  if (!rest.firstname?.trim() && !rest.lastname?.trim()) return void (error.value = 'Indiquez le prénom ou le nom.')
  try {
    const payload = { ...rest, valid_until: toApiDate(valid) }
    if (editing.value) await api.badges.update(editing.value.id, payload)
    else await api.badges.create(props.projectId, payload)
    editOpen.value = false
    await load()
  } catch (e) {
    error.value = errorDetail(e)
  }
}

async function runImport(): Promise<void> {
  if (!preview.value.badges.length) return
  try {
    badges.value = await api.badges.import(props.projectId, preview.value.badges, templateId.value)
    emit('count', badges.value.length)
    toast.add({ severity: 'success', summary: `${preview.value.badges.length} badge(s) importé(s)`, life: 3000 })
    importOpen.value = false
    importText.value = ''
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Import impossible', detail: errorDetail(e), life: 6000 })
  }
}

async function onPhoto(b: Badge, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const updated = await api.badges.uploadPhoto(b.id, file, file.name)
    badges.value = badges.value.map((x) => (x.id === b.id ? updated : x))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Photo refusée', detail: errorDetail(e), life: 5000 })
  }
}

async function print(layout: 'cards' | 'sheet'): Promise<void> {
  printing.value = true
  try {
    const url = URL.createObjectURL(await api.badges.pdf(props.projectId, layout, selected.value))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    void load()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Impression impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    printing.value = false
  }
}

async function applyTemplate(): Promise<void> {
  if (!selected.value.length) return
  await Promise.all(selected.value.map((id) => api.badges.update(id, { badge_template_id: templateId.value })))
  await load()
}

function remove(b: Badge): void {
  confirm.require({
    header: 'Supprimer le badge',
    message: `Supprimer le badge de ${b.full_name || 'cette personne'} ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.badges.remove(b.id)
      selected.value = selected.value.filter((id) => id !== b.id)
      await load()
    },
  })
}
</script>

<template>
  <div class="badges">
    <div class="toolbar">
      <Select v-model="templateId" :options="templates" option-label="name" option-value="id" placeholder="Modèle" class="tpl" />
      <Button label="Modèles" icon="pi pi-palette" text size="small" @click="templatesOpen = true" />
      <Button v-if="selected.length && auth.can('badges.update')" :label="`Appliquer le modèle (${selected.length})`" text size="small" @click="applyTemplate" />
      <span class="grow" />
      <Button v-if="auth.can('badges.create')" label="Importer une liste" icon="pi pi-upload" text size="small" @click="importOpen = true" />
      <Button v-if="auth.can('badges.create')" label="Nouveau badge" icon="pi pi-plus" size="small" @click="edit(null)" />
      <Button :label="selected.length ? `Cartes (${selected.length})` : 'Cartes'" icon="pi pi-id-card" severity="secondary" size="small" :loading="printing" :disabled="!badges.length" @click="print('cards')" />
      <Button :label="selected.length ? `Planche A4 (${selected.length})` : 'Planche A4'" icon="pi pi-th-large" severity="secondary" size="small" :loading="printing" :disabled="!badges.length" @click="print('sheet')" />
    </div>

    <table v-if="badges.length" class="list">
      <thead>
        <tr><th><Checkbox v-model="allSelected" binary aria-label="Tout sélectionner" /></th><th>Photo</th><th>Personne</th><th>Fonction / service</th><th>Matricule</th><th>Modèle</th><th>Imprimé</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="b in badges" :key="b.id">
          <td><Checkbox v-model="selected" :value="b.id" :aria-label="`Sélectionner ${b.full_name}`" /></td>
          <td>
            <label class="photo" :title="auth.can('badges.update') ? 'Changer la photo' : ''">
              <img v-if="b.photo_url" :src="b.photo_url" alt="" />
              <i v-else class="pi pi-camera muted" />
              <input v-if="auth.can('badges.update')" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onPhoto(b, $event)" />
            </label>
          </td>
          <td><button type="button" class="link" @click="edit(b)">{{ b.full_name || '—' }}</button></td>
          <td class="small">{{ [b.job_title, b.department, b.division].filter(Boolean).join(' · ') }}</td>
          <td>{{ b.employee_number }}</td>
          <td class="small">{{ templateName(b.badge_template_id) }}</td>
          <td class="small">{{ b.printed_at ? formatDate(b.printed_at.slice(0, 10)) : '—' }}</td>
          <td><Button v-if="auth.can('badges.delete')" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="remove(b)" /></td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">Aucun badge. Ajoutez les personnes une à une, ou collez la liste depuis un tableur.</p>

    <Dialog v-model:visible="editOpen" :header="editing ? 'Modifier le badge' : 'Nouveau badge'" modal :style="{ width: '560px' }">
      <form id="badge-form" class="form-grid" @submit.prevent="save">
        <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
        <div class="form-field"><label for="bd-fn">Prénom</label><InputText id="bd-fn" v-model="form.firstname" /></div>
        <div class="form-field"><label for="bd-ln">Nom</label><InputText id="bd-ln" v-model="form.lastname" /></div>
        <div class="form-field"><label for="bd-job">Fonction</label><InputText id="bd-job" v-model="form.job_title" /></div>
        <div class="form-field"><label for="bd-dep">Service</label><InputText id="bd-dep" v-model="form.department" /></div>
        <div class="form-field"><label for="bd-div">Direction</label><InputText id="bd-div" v-model="form.division" /></div>
        <div class="form-field"><label for="bd-num">Matricule</label><InputText id="bd-num" v-model="form.employee_number" /></div>
        <div class="form-field"><label for="bd-valid">Valable jusqu'au</label><DatePicker v-model="form.valid" input-id="bd-valid" date-format="dd/mm/yy" show-button-bar /></div>
        <div class="form-field"><label for="bd-tpl">Modèle</label><Select id="bd-tpl" v-model="form.badge_template_id" :options="[{ id: null, name: '—' }, ...templates]" option-label="name" option-value="id" /></div>
        <div class="form-field form-field--full"><label for="bd-addr">Adresse</label><InputText id="bd-addr" v-model="form.address" /></div>
      </form>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="editOpen = false" />
        <Button label="Enregistrer" icon="pi pi-check" type="submit" form="badge-form" />
      </template>
    </Dialog>

    <Dialog v-model:visible="importOpen" header="Importer une liste" modal :style="{ width: '640px' }">
      <p class="small muted">Copiez les colonnes depuis Excel ou un CSV, avec la ligne d'en-tête : Prénom, Nom, Fonction, Service, Direction, Matricule, Adresse, Validité.</p>
      <Textarea v-model="importText" rows="8" fluid placeholder="Prénom;Nom;Fonction;Matricule" class="mono" />
      <p class="small">
        {{ preview.badges.length }} personne(s) reconnue(s)<template v-if="templateId"> — modèle « {{ templateName(templateId) }} »</template>.
        <span v-if="preview.unknownColumns.length" class="muted">Colonnes ignorées : {{ preview.unknownColumns.join(', ') }}.</span>
      </p>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="importOpen = false" />
        <Button :label="`Importer ${preview.badges.length || ''}`" icon="pi pi-upload" :disabled="!preview.badges.length" @click="runImport" />
      </template>
    </Dialog>

    <BadgeTemplatesDialog v-model:visible="templatesOpen" :client-id="props.clientId" @changed="templates = $event" />
  </div>
</template>

<style scoped>
.badges {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.tpl {
  min-width: 200px;
}

.photo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 46px;
  border-radius: 4px;
  background: var(--p-content-hover-background);
  overflow: hidden;
  cursor: pointer;
}

.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mono {
  font-family: ui-monospace, monospace;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.85rem;
}

.link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
</style>
