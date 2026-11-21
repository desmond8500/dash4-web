<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { Sheet, SheetZone, Site } from '@dash4/shared'
import { api } from '@/services/api'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'

/** Fiches techniques du chantier (zones d'alarme, lecteurs…) : tableau des zones et PDF. */
const props = defineProps<{ site: Site }>()
const toast = useToast()
const confirm = useConfirm()

type Zone = Omit<SheetZone, 'id' | 'position'>
const list = ref<Sheet[]>([])
const open = ref(false)
const current = ref<Sheet | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)
const form = ref(blank())

function blank() {
  return {
    title: '', type: '', date: new Date() as Date | null, installed_system_id: null as number | null, building_id: null as number | null,
    contact_name: '', contact_phone: '', contact_email: '', notes: '', zones: [] as Zone[],
  }
}
const equipment = computed(() => props.site.systems.flatMap((s) => (s.equipment ?? []).map((e) => ({ id: e.id, label: `${e.name} — ${s.name}` }))))
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
const blankZone = (n: number): Zone => ({ number: String(n), name: '', code: null, equipment_label: null, equipment_id: null, room_id: null })

async function load(): Promise<void> {
  list.value = await api.sheets.list(props.site.project.id).catch(() => [])
}
watch(() => props.site.project.id, load, { immediate: true })

function edit(s: Sheet | null): void {
  current.value = s
  error.value = null
  form.value = s
    ? {
        title: s.title, type: s.type ?? '', date: fromApiDate(s.date), installed_system_id: s.installed_system_id, building_id: s.building_id,
        contact_name: s.contact_name ?? '', contact_phone: s.contact_phone ?? '', contact_email: s.contact_email ?? '', notes: s.notes ?? '',
        zones: (s.zones ?? []).map(({ number, name, code, equipment_label, equipment_id, room_id }) => ({ number, name, code, equipment_label, equipment_id, room_id })),
      }
    : { ...blank(), zones: [blankZone(1)] }
  open.value = true
}
function onEquipment(z: Zone): void {
  const e = equipment.value.find((x) => x.id === z.equipment_id)
  if (e && !z.equipment_label) z.equipment_label = e.label.split(' — ')[0] ?? null
}

async function save(): Promise<void> {
  const f = form.value
  if (!f.title.trim()) return void (error.value = 'Donnez un titre à la fiche.')
  const zones = f.zones.filter((z) => z.number.trim() && z.name.trim())
  saving.value = true
  try {
    const payload = {
      title: f.title.trim(), type: f.type.trim() || null, date: toApiDate(f.date), installed_system_id: f.installed_system_id, building_id: f.building_id,
      contact_name: f.contact_name.trim() || null, contact_phone: f.contact_phone.trim() || null, contact_email: f.contact_email.trim() || null,
      notes: f.notes.trim() || null, zones,
    }
    current.value = current.value ? await api.sheets.update(current.value.id, payload) : await api.sheets.create(props.site.project.id, payload)
    open.value = false
    await load()
  } catch (e) {
    error.value = errorDetail(e)
  } finally {
    saving.value = false
  }
}

async function pdf(s: Sheet): Promise<void> {
  try {
    const url = URL.createObjectURL(await api.sheets.pdf(s.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: errorDetail(e), life: 5000 })
  }
}
function remove(s: Sheet): void {
  confirm.require({
    header: 'Supprimer la fiche',
    message: `Supprimer « ${s.title} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.sheets.remove(s.id)
      await load()
    },
  })
}
</script>

<template>
  <div class="sheets">
    <div class="head">
      <span class="grow muted">Fiches de zones (alarme, détection, contrôle d'accès…), imprimables et reprises dans le DOE.</span>
      <Button v-if="props.site.can.create" label="Nouvelle fiche" icon="pi pi-plus" size="small" @click="edit(null)" />
    </div>
    <table v-if="list.length" class="list">
      <thead><tr><th>Fiche</th><th>Type</th><th>Date</th><th>Zones</th><th /></tr></thead>
      <tbody>
        <tr v-for="s in list" :key="s.id">
          <td><button type="button" class="link" @click="edit(s)">{{ s.title }}</button></td>
          <td>{{ s.type }}</td>
          <td>{{ formatDate(s.date) }}</td>
          <td>{{ s.zones?.length ?? 0 }}</td>
          <td class="actions">
            <Button icon="pi pi-file-pdf" text rounded size="small" aria-label="PDF" @click="pdf(s)" />
            <Button v-if="props.site.can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="remove(s)" />
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">Aucune fiche.</p>

    <Dialog v-model:visible="open" :header="current ? current.title : 'Nouvelle fiche technique'" modal :style="{ width: '900px' }" :breakpoints="{ '940px': '96vw' }">
      <form id="sheet-form" class="form-grid" @submit.prevent="save">
        <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
        <div class="form-field"><label for="sh-title">Titre</label><InputText id="sh-title" v-model="form.title" placeholder="Zones alarme — bâtiment A" /></div>
        <div class="form-field"><label for="sh-type">Type</label><InputText id="sh-type" v-model="form.type" placeholder="Alarme, incendie…" /></div>
        <div class="form-field"><label for="sh-date">Date</label><DatePicker v-model="form.date" input-id="sh-date" date-format="dd/mm/yy" /></div>
        <div v-if="props.site.systems.length" class="form-field">
          <label for="sh-sys">Système</label>
          <Select id="sh-sys" v-model="form.installed_system_id" :options="[{ id: null, name: '—' }, ...props.site.systems]" option-label="name" option-value="id" />
        </div>
        <div class="form-field"><label for="sh-cn">Contact sur place</label><InputText id="sh-cn" v-model="form.contact_name" /></div>
        <div class="form-field"><label for="sh-cp">Téléphone</label><InputText id="sh-cp" v-model="form.contact_phone" /></div>
        <div class="form-field form-field--full">
          <table class="list zones">
            <thead><tr><th style="width:80px">N°</th><th>Zone</th><th style="width:120px">Code</th><th style="width:260px">Équipement</th><th /></tr></thead>
            <tbody>
              <tr v-for="(z, i) in form.zones" :key="i">
                <td><InputText v-model="z.number" fluid /></td>
                <td><InputText v-model="z.name" placeholder="Porte d'entrée" fluid /></td>
                <td><InputText v-model="z.code" fluid /></td>
                <td>
                  <InputText v-model="z.equipment_label" placeholder="Détecteur IRP" fluid />
                  <Select v-if="equipment.length" v-model="z.equipment_id" :options="[{ id: null, label: 'Lier à un équipement…' }, ...equipment]" option-label="label" option-value="id" filter fluid class="link-eq" @change="onEquipment(z)" />
                </td>
                <td><Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="form.zones.splice(i, 1)" /></td>
              </tr>
            </tbody>
          </table>
          <Button label="Ajouter une zone" icon="pi pi-plus" text size="small" @click="form.zones.push(blankZone(form.zones.length + 1))" />
        </div>
        <div class="form-field form-field--full"><label for="sh-notes">Notes</label><MarkdownEditor id="sh-notes" v-model="form.notes" rows="2" auto-resize /></div>
      </form>
      <template #footer>
        <Button v-if="current" label="PDF" icon="pi pi-file-pdf" text severity="secondary" @click="pdf(current!)" />
        <Button label="Annuler" text severity="secondary" @click="open = false" />
        <Button v-if="!current || props.site.can.manage" label="Enregistrer" icon="pi pi-check" type="submit" form="sheet-form" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.sheets {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zones td {
  vertical-align: top;
}

.link-eq {
  margin-top: 0.25rem;
}

.actions {
  text-align: right;
  white-space: nowrap;
}

.grow {
  flex: 1;
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
