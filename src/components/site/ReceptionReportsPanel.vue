<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, RECEPTION_STATUSES } from '@dash4/shared'
import type { ReceptionParty, ReceptionReport, ReceptionReportPayload, ReceptionStatus, Reserve, Site } from '@dash4/shared'
import { api } from '@/services/api'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { reservesSummary } from '@/utils/site'

/** Procès-verbaux de réception du chantier : parties et logos, systèmes, réserves, PDF, copie signée. */
const props = defineProps<{ projectId: number; site: Site | null }>()
// Chantier chargé ici si l'onglet Chantier n'a pas encore été ouvert
const ownSite = ref<Site | null>(null)
const site = computed(() => props.site ?? ownSite.value)
const toast = useToast()
const confirm = useConfirm()

const reports = ref<ReceptionReport[]>([])
const loading = ref(false)
const open = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const current = ref<ReceptionReport | null>(null)
const form = ref(blank())

function blank() {
  return {
    title: 'Réception des travaux', subtitle: '', date: new Date() as Date | null, status: 'draft' as ReceptionStatus, location: '',
    names: { client: '', owner: '', engineer: '', inspector: '' } as Record<ReceptionParty, string>,
    observations: '', reserves: [] as Array<{ text: string; lifted: Date | null }>, system_ids: [] as number[],
  }
}
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
const statusSeverity = (s: ReceptionStatus) => ({ draft: 'secondary', with_reserves: 'warn', accepted: 'success', signed: 'success' } as const)[s]

async function load(): Promise<void> {
  loading.value = true
  try {
    reports.value = await api.receptionReports.list(props.projectId)
    if (!props.site) ownSite.value = await api.sites.get(props.projectId).catch(() => null)
  } finally {
    loading.value = false
  }
}
watch(() => props.projectId, load, { immediate: true })

function edit(r: ReceptionReport | null): void {
  current.value = r
  error.value = null
  const f = blank()
  if (r) {
    Object.assign(f, {
      title: r.title, subtitle: r.subtitle ?? '', date: fromApiDate(r.date), status: r.status.value, location: r.location ?? '',
      observations: r.observations ?? '', system_ids: (r.systems ?? []).map((s) => s.id),
      reserves: r.reserves.map((x) => ({ text: x.text, lifted: x.lifted_at ? fromApiDate(x.lifted_at.slice(0, 10)) : null })),
    })
    for (const p of r.parties) f.names[p.key] = p.name ?? ''
  } else {
    f.system_ids = (site.value?.systems ?? []).map((s) => s.id)
  }
  form.value = f
  open.value = true
}

function payload(): ReceptionReportPayload & { title: string; date: string } {
  const f = form.value
  const reserves: Reserve[] = f.reserves.filter((r) => r.text.trim()).map((r) => ({ text: r.text.trim(), lifted_at: toApiDate(r.lifted) }))
  return {
    title: f.title.trim(), subtitle: f.subtitle.trim() || null, date: toApiDate(f.date)!, status: f.status, location: f.location.trim() || null,
    client_name: f.names.client.trim() || null, owner_name: f.names.owner.trim() || null,
    engineer_name: f.names.engineer.trim() || null, inspector_name: f.names.inspector.trim() || null,
    observations: f.observations.trim() || null, reserves, system_ids: f.system_ids,
  }
}

async function save(): Promise<void> {
  if (!form.value.title.trim() || !form.value.date) {
    error.value = 'Indiquez le titre et la date.'
    return
  }
  saving.value = true
  try {
    const saved = current.value ? await api.receptionReports.update(current.value.id, payload()) : await api.receptionReports.create(props.projectId, payload())
    current.value = saved
    await load()
    toast.add({ severity: 'success', summary: 'Procès-verbal enregistré', life: 2500 })
  } catch (e) {
    error.value = errorDetail(e)
  } finally {
    saving.value = false
  }
}

async function onLogo(party: ReceptionParty, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !current.value) return
  try {
    current.value = await api.receptionReports.uploadLogo(current.value.id, party, file, file.name)
    await load()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Logo refusé', detail: errorDetail(e), life: 5000 })
  }
}
async function removeLogo(party: ReceptionParty): Promise<void> {
  if (!current.value) return
  current.value = await api.receptionReports.removeLogo(current.value.id, party)
}
const logo = (party: ReceptionParty) => current.value?.parties.find((p) => p.key === party)?.logo_url ?? null

async function openPdf(r: ReceptionReport): Promise<void> {
  try {
    const url = URL.createObjectURL(await api.receptionReports.pdf(r.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: errorDetail(e), life: 5000 })
  }
}
function remove(r: ReceptionReport): void {
  confirm.require({
    header: 'Supprimer le procès-verbal',
    message: `Supprimer « ${r.title} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.receptionReports.remove(r.id)
      await load()
    },
  })
}
const parties: Array<{ key: ReceptionParty; label: string }> = [
  { key: 'client', label: 'Client' },
  { key: 'owner', label: "Maître d'ouvrage" },
  { key: 'engineer', label: "Maître d'œuvre" },
  { key: 'inspector', label: 'Bureau de contrôle' },
]
</script>

<template>
  <div class="reports">
    <div class="head">
      <span class="grow muted">Le PDF reprend les parties et leurs logos, les systèmes réceptionnés, les réserves et la signature de l'entreprise. La copie signée se joint au PV.</span>
      <Button v-if="site?.can.create" label="Nouveau PV" icon="pi pi-plus" size="small" @click="edit(null)" />
    </div>
    <table v-if="reports.length" class="list">
      <thead><tr><th>Procès-verbal</th><th>Date</th><th>Statut</th><th>Réserves</th><th /></tr></thead>
      <tbody>
        <tr v-for="r in reports" :key="r.id">
          <td><button type="button" class="link" @click="edit(r)">{{ r.title }}</button><div v-if="r.subtitle" class="muted small">{{ r.subtitle }}</div></td>
          <td>{{ formatDate(r.date) }}</td>
          <td><Tag :value="r.status.label" :severity="statusSeverity(r.status.value)" /></td>
          <td class="small">{{ reservesSummary(r.reserves) }}</td>
          <td class="actions">
            <Button icon="pi pi-file-pdf" text rounded size="small" aria-label="PDF" @click="openPdf(r)" />
            <Button v-if="r.can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="remove(r)" />
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!loading" class="muted">Aucun procès-verbal.</p>

    <Dialog v-model:visible="open" :header="current ? current.title : 'Nouveau procès-verbal de réception'" modal :style="{ width: '760px' }" :breakpoints="{ '800px': '95vw' }">
      <form id="pv-form" class="form-grid" @submit.prevent="save">
        <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
        <div class="form-field form-field--full"><label for="pv-title">Titre</label><InputText id="pv-title" v-model="form.title" :disabled="current ? !current.can.update : false" /></div>
        <div class="form-field form-field--full"><label for="pv-sub">Sous-titre</label><InputText id="pv-sub" v-model="form.subtitle" placeholder="Lot, phase…" /></div>
        <div class="form-field"><label for="pv-date">Date</label><DatePicker v-model="form.date" input-id="pv-date" date-format="dd/mm/yy" /></div>
        <div class="form-field"><label for="pv-status">Décision</label><Select id="pv-status" v-model="form.status" :options="RECEPTION_STATUSES" option-label="label" option-value="value" /></div>
        <div class="form-field form-field--full"><label for="pv-loc">Lieu</label><InputText id="pv-loc" v-model="form.location" /></div>

        <div class="form-field form-field--full"><label>Parties</label></div>
        <div v-for="p in parties" :key="p.key" class="form-field party">
          <label :for="`pv-${p.key}`">{{ p.label }}</label>
          <InputText :id="`pv-${p.key}`" v-model="form.names[p.key]" />
          <div v-if="current" class="logo-row">
            <img v-if="logo(p.key)" :src="logo(p.key)!" alt="" />
            <label class="link small">{{ logo(p.key) ? 'Changer le logo' : 'Ajouter un logo' }}<input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onLogo(p.key, $event)" /></label>
            <Button v-if="logo(p.key)" icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Retirer le logo" @click="removeLogo(p.key)" />
          </div>
        </div>
        <p v-if="!current" class="form-field--full muted small">Les logos s'ajoutent une fois le PV enregistré.</p>

        <div v-if="site?.systems.length" class="form-field form-field--full">
          <label>Systèmes réceptionnés</label>
          <div class="checks">
            <label v-for="s in site?.systems ?? []" :key="s.id" class="check"><Checkbox v-model="form.system_ids" :value="s.id" /> {{ s.name }} <span class="muted small">({{ s.progress }} %)</span></label>
          </div>
        </div>

        <div class="form-field form-field--full">
          <label>Réserves</label>
          <div v-for="(r, i) in form.reserves" :key="i" class="row">
            <InputText v-model="r.text" class="grow" placeholder="Réserve" />
            <DatePicker v-model="r.lifted" date-format="dd/mm/yy" placeholder="Levée le" show-button-bar class="lifted" />
            <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="form.reserves.splice(i, 1)" />
          </div>
          <Button label="Ajouter une réserve" icon="pi pi-plus" text size="small" @click="form.reserves.push({ text: '', lifted: null })" />
        </div>
        <div class="form-field form-field--full"><label for="pv-obs">Observations</label><MarkdownEditor id="pv-obs" v-model="form.observations" rows="3" auto-resize /></div>
      </form>
      <template v-if="current">
        <h4>Copie signée et documents</h4>
        <AttachmentsPanel kind="documents" type="reception-reports" :id="current.id" :can-add="current.can.update" :can-manage="current.can.delete" />
      </template>
      <template #footer>
        <Button v-if="current" label="PDF" icon="pi pi-file-pdf" severity="secondary" text @click="openPdf(current!)" />
        <Button label="Fermer" severity="secondary" text @click="open = false" />
        <Button v-if="!current || current.can.update" label="Enregistrer" icon="pi pi-check" type="submit" form="pv-form" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.reports {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.head,
.row,
.logo-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.85rem;
}

.actions {
  text-align: right;
  white-space: nowrap;
}

.logo-row img {
  max-height: 32px;
  max-width: 90px;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.lifted {
  width: 150px;
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
