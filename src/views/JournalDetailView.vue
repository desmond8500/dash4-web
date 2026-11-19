<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, JOURNAL_TYPES } from '@dash4/shared'
import type { Assignee, Contact, Journal, JournalParticipantPayload, JournalPayload, JournalType } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { fromApiDateTime, toApiDateTime } from '@/utils/tasks'

/** Journal d'intervention : en-tête, résumé, sections, intervenants, photos, PDF. */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const journal = ref<Journal | null>(null)
const loading = ref(true)
const busy = ref(false)
const tab = ref('documents')
const people = ref<Assignee[]>([])
const contacts = ref<Contact[]>([])
const header = ref({ title: '', type: 'intervention' as JournalType, date: null as Date | null, starts: null as Date | null, ends: null as Date | null, summary: '' })
const sections = ref<Array<{ title: string; body: string }>>([])
const newPerson = ref<number | null>(null)
const newContact = ref<number | null>(null)
const newName = ref('')
const editable = computed(() => !!journal.value?.can.update)
const mapUrl = computed(() => (journal.value?.latitude != null ? `https://www.openstreetmap.org/?mlat=${journal.value.latitude}&mlon=${journal.value.longitude}#map=17/${journal.value.latitude}/${journal.value.longitude}` : null))

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

function set(j: Journal): void {
  journal.value = j
  header.value = { title: j.title, type: j.type.value, date: fromApiDate(j.date), starts: fromApiDateTime(j.starts_at), ends: fromApiDateTime(j.ends_at), summary: j.summary ?? '' }
  sections.value = (j.sections ?? []).map((s) => ({ title: s.title, body: s.body ?? '' }))
}

async function load(): Promise<void> {
  loading.value = true
  try {
    set(await api.journals.get(Number(props.id)))
    if (editable.value) {
      people.value = await api.assignees.list().catch(() => [])
      if (journal.value?.client_id) contacts.value = (await api.contacts.list({ client_id: journal.value.client_id, per_page: 100 }).catch(() => ({ data: [] as Contact[] }))).data
    }
  } catch {
    journal.value = null
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

async function save(payload: Omit<JournalPayload, 'client_uuid'>): Promise<void> {
  if (!journal.value) return
  busy.value = true
  try {
    set(await api.journals.update(journal.value.id, payload))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    busy.value = false
  }
}
function saveHeader(field: 'title' | 'type' | 'date' | 'times' | 'summary'): void {
  const h = header.value
  if (field === 'title' && !h.title.trim()) return
  const payload: Omit<JournalPayload, 'client_uuid'> =
    field === 'date' ? { date: toApiDate(h.date) ?? undefined }
    : field === 'times' ? { starts_at: toApiDateTime(h.starts), ends_at: toApiDateTime(h.ends) }
    : field === 'summary' ? { summary: h.summary.trim() || null }
    : field === 'type' ? { type: h.type }
    : { title: h.title.trim() }
  void save(payload)
}
const saveSections = () => save({ sections: sections.value.filter((s) => s.title.trim()).map((s) => ({ title: s.title.trim(), body: s.body.trim() || null })) })
function addSection(): void {
  sections.value.push({ title: 'Nouvelle section', body: '' })
  void saveSections()
}
function removeSection(i: number): void {
  sections.value.splice(i, 1)
  void saveSections()
}
function moveSection(i: number, step: -1 | 1): void {
  const j = i + step
  if (j < 0 || j >= sections.value.length) return
  const [s] = sections.value.splice(i, 1)
  sections.value.splice(j, 0, s!)
  void saveSections()
}

// Intervenants
const currentParticipants = (): JournalParticipantPayload[] =>
  (journal.value?.participants ?? []).map((p) => ({ user_id: p.user_id, contact_id: p.contact_id, name: p.kind === 'other' ? p.name : null, role: p.role }))
function addParticipant(p: JournalParticipantPayload): void {
  void save({ participants: [...currentParticipants(), p] })
  newPerson.value = null
  newContact.value = null
  newName.value = ''
}
const removeParticipant = (id: number) =>
  save({ participants: (journal.value?.participants ?? []).filter((p) => p.id !== id).map((p) => ({ user_id: p.user_id, contact_id: p.contact_id, name: p.kind === 'other' ? p.name : null, role: p.role })) })

async function openPdf(): Promise<void> {
  busy.value = true
  try {
    const url = URL.createObjectURL(await api.journals.pdf(journal.value!.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    busy.value = false
  }
}
function remove(): void {
  confirm.require({
    header: 'Supprimer le journal',
    message: `Supprimer « ${journal.value?.title} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.journals.remove(journal.value!.id)
      void router.push({ name: 'journals' })
    },
  })
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !journal" class="center"><ProgressSpinner /></div>
    <div v-else-if="!journal" class="center">
      <p>Ce journal n'existe pas, a été supprimé, ou ne vous concerne pas.</p>
      <RouterLink :to="{ name: 'journals' }">Retour aux journaux</RouterLink>
    </div>

    <template v-else>
      <RouterLink :to="{ name: 'journals' }" class="back"><i class="pi pi-arrow-left" /> Journaux</RouterLink>
      <div class="page-header">
        <h1>{{ journal.title }}</h1>
        <div class="actions">
          <Button label="Rapport PDF" icon="pi pi-file-pdf" severity="secondary" :loading="busy" @click="openPdf" />
          <Button v-if="journal.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" @click="remove" />
        </div>
      </div>

      <div class="layout">
        <div class="main">
          <Card>
            <template #content>
              <div class="form-grid">
                <div class="form-field form-field--full"><label for="j-title">Titre</label><InputText id="j-title" v-model="header.title" :disabled="!editable" @change="saveHeader('title')" /></div>
                <div class="form-field"><label for="j-type">Type</label><Select id="j-type" v-model="header.type" :options="JOURNAL_TYPES" option-label="label" option-value="value" :disabled="!editable" @change="saveHeader('type')" /></div>
                <div class="form-field"><label for="j-date">Date</label><DatePicker v-model="header.date" input-id="j-date" date-format="dd/mm/yy" :disabled="!editable" @update:model-value="saveHeader('date')" /></div>
                <div class="form-field"><label for="j-starts">Début</label><DatePicker v-model="header.starts" input-id="j-starts" time-only hour-format="24" :disabled="!editable" @hide="saveHeader('times')" /></div>
                <div class="form-field"><label for="j-ends">Fin</label><DatePicker v-model="header.ends" input-id="j-ends" time-only hour-format="24" :disabled="!editable" @hide="saveHeader('times')" /></div>
                <div class="form-field form-field--full"><label for="j-summary">Résumé</label><Textarea id="j-summary" v-model="header.summary" rows="2" auto-resize :disabled="!editable" @change="saveHeader('summary')" /></div>
              </div>
            </template>
          </Card>

          <Card>
            <template #title>Sections</template>
            <template #content>
              <div v-for="(s, i) in sections" :key="i" class="section">
                <div class="section-head">
                  <InputText v-model="s.title" class="grow" :disabled="!editable" @change="saveSections" />
                  <template v-if="editable">
                    <Button icon="pi pi-arrow-up" text rounded size="small" aria-label="Monter" :disabled="i === 0" @click="moveSection(i, -1)" />
                    <Button icon="pi pi-arrow-down" text rounded size="small" aria-label="Descendre" :disabled="i === sections.length - 1" @click="moveSection(i, 1)" />
                    <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer la section" @click="removeSection(i)" />
                  </template>
                </div>
                <Textarea v-model="s.body" rows="3" auto-resize fluid :disabled="!editable" placeholder="Ce qui a été fait, constaté, ce qui reste…" @change="saveSections" />
              </div>
              <p v-if="!sections.length" class="muted">Aucune section.</p>
              <Button v-if="editable" label="Ajouter une section" icon="pi pi-plus" size="small" text @click="addSection" />
            </template>
          </Card>

          <Tabs v-model:value="tab">
            <TabList>
              <Tab value="documents">Photos et documents</Tab>
              <Tab value="notes">Notes</Tab>
            </TabList>
            <TabPanels>
              <TabPanel v-for="kind in (['documents', 'notes'] as const)" :key="kind" :value="kind">
                <AttachmentsPanel :kind="kind" type="journals" :id="journal!.id" :can-add="journal!.can.update" :can-manage="journal!.can.delete" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        <aside class="side">
          <Card>
            <template #title>Intervenants</template>
            <template #content>
              <ul class="participants">
                <li v-for="p in journal.participants" :key="p.id">
                  <i :class="p.kind === 'team' ? 'pi pi-user' : p.kind === 'contact' ? 'pi pi-id-card' : 'pi pi-user-plus'" class="muted" />
                  <span class="grow">{{ p.name }}<small v-if="p.role" class="muted"> · {{ p.role }}</small></span>
                  <Button v-if="editable" icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Retirer" @click="removeParticipant(p.id)" />
                </li>
              </ul>
              <div v-if="editable" class="add-participants">
                <Select v-if="people.length" v-model="newPerson" :options="people" option-label="full_name" option-value="id" filter placeholder="Ajouter un membre de l'équipe" @change="newPerson && addParticipant({ user_id: newPerson })" />
                <Select v-if="contacts.length" v-model="newContact" :options="contacts" option-label="full_name" option-value="id" placeholder="Ajouter un contact du client" @change="newContact && addParticipant({ contact_id: newContact })" />
                <form class="row" @submit.prevent="newName.trim() && addParticipant({ name: newName.trim() })">
                  <InputText v-model="newName" placeholder="Autre personne" class="grow" />
                  <Button type="submit" icon="pi pi-plus" size="small" aria-label="Ajouter" :disabled="!newName.trim()" />
                </form>
              </div>
            </template>
          </Card>
          <Card>
            <template #content>
              <dl class="facts">
                <dt>Projet</dt><dd><RouterLink v-if="journal.project" :to="{ name: 'project', params: { id: journal.project.id } }">{{ journal.project.name }}</RouterLink><template v-else>—</template></dd>
                <dt>Client</dt><dd><RouterLink v-if="journal.client" :to="{ name: 'client', params: { id: journal.client.id } }">{{ journal.client.name }}</RouterLink><template v-else>—</template></dd>
                <template v-if="journal.task"><dt>Tâche</dt><dd><RouterLink :to="{ name: 'task', params: { id: journal.task.id } }">{{ journal.task.title }}</RouterLink></dd></template>
                <template v-if="mapUrl"><dt>Position</dt><dd><a :href="mapUrl" target="_blank" rel="noopener"><i class="pi pi-map-marker" /> Voir sur la carte</a></dd></template>
                <dt>Rédigé par</dt><dd>{{ journal.creator?.full_name ?? '—' }}<div class="muted small">{{ formatDate(journal.created_at?.slice(0, 10) ?? null) }}</div></dd>
              </dl>
            </template>
          </Card>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.main,
.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.section {
  margin-bottom: 1rem;
}

.section-head,
.row {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin-bottom: 0.375rem;
}

.grow {
  flex: 1;
}

.participants {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
}

.participants li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.add-participants {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
  margin: 0;
}

.facts dt {
  color: var(--p-text-muted-color);
}

.facts dd {
  margin: 0;
}

.small {
  font-size: 0.8rem;
}
</style>
