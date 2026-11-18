<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import SelectButton from 'primevue/selectbutton'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { DELIVERY_NOTE_TYPE_LABELS } from '@dash4/shared'
import type { DeliveryNote, DeliveryNoteLine, DeliveryNoteType, Quote } from '@dash4/shared'
import { api } from '@/services/api'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'

/** Bordereaux de livraison ou de travaux : équipements du devis repris par défaut, sans prix. */
const props = defineProps<{ quote: Quote; canEdit: boolean }>()
const emit = defineEmits<{ run: [action: () => Promise<Quote>] }>()
const toast = useToast()

const types = (Object.entries(DELIVERY_NOTE_TYPE_LABELS) as Array<[DeliveryNoteType, string]>).map(([value, label]) => ({ value, label }))
const open = ref(false)
const edited = ref<DeliveryNote | null>(null)
const form = ref({
  type: 'delivery' as DeliveryNoteType,
  title: '',
  date: new Date() as Date | null,
  done: '',
  todo: '',
  show_logo: true,
  lines: [] as Array<Omit<DeliveryNoteLine, 'id'>>,
})

function create(type: DeliveryNoteType): void {
  emit('run', () => api.quotes.addDeliveryNote(props.quote.id, { type }))
}

function edit(note: DeliveryNote): void {
  edited.value = note
  form.value = {
    type: note.type.value,
    title: note.title,
    date: fromApiDate(note.delivered_at),
    done: note.done ?? '',
    todo: note.todo ?? '',
    show_logo: note.show_logo,
    lines: note.lines.map((l) => ({ designation: l.designation, reference: l.reference, unit: l.unit, quantity: l.quantity })),
  }
  open.value = true
}

function save(): void {
  const note = edited.value
  if (!note) return
  const f = form.value
  emit('run', () =>
    api.quotes.updateDeliveryNote(note.id, {
      type: f.type,
      title: f.title.trim() || props.quote.title,
      delivered_at: toApiDate(f.date) ?? undefined,
      done: f.done.trim() || null,
      todo: f.todo.trim() || null,
      show_logo: f.show_logo,
      lines: f.lines.filter((l) => l.designation.trim()),
    }),
  )
  open.value = false
}

async function pdf(note: DeliveryNote): Promise<void> {
  try {
    const url = URL.createObjectURL(await api.quotes.deliveryNotePdf(note.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'PDF impossible', detail: (e as Error).message, life: 4000 })
  }
}

const remove = (note: DeliveryNote) => emit('run', () => api.quotes.removeDeliveryNote(note.id))
</script>

<template>
  <div class="panel">
    <div v-if="props.canEdit" class="add">
      <Button label="Bordereau de livraison" icon="pi pi-truck" size="small" @click="create('delivery')" />
      <Button label="Bordereau de travaux" icon="pi pi-wrench" size="small" severity="secondary" @click="create('works')" />
      <small class="muted">Les équipements du devis (centrale, organes, câble) sont repris ; à ajuster ensuite.</small>
    </div>

    <table v-if="props.quote.delivery_notes?.length" class="list">
      <thead><tr><th>Numéro</th><th>Type</th><th>Objet</th><th>Date</th><th>Lignes</th><th /></tr></thead>
      <tbody>
        <tr v-for="n in props.quote.delivery_notes" :key="n.id">
          <td><strong>{{ n.number }}</strong></td>
          <td>{{ n.type.label }}</td>
          <td>{{ n.title }}</td>
          <td>{{ formatDate(n.delivered_at) }}</td>
          <td>{{ n.lines.length }}</td>
          <td class="actions">
            <Button icon="pi pi-file-pdf" size="small" text rounded aria-label="PDF" @click="pdf(n)" />
            <template v-if="props.canEdit">
              <Button icon="pi pi-pencil" size="small" text rounded aria-label="Modifier" @click="edit(n)" />
              <Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer" @click="remove(n)" />
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">Aucun bordereau.</p>

    <Dialog v-model:visible="open" :header="edited?.number" modal :style="{ width: '760px' }" :breakpoints="{ '800px': '95vw' }">
      <form id="bl-form" class="form-grid" @submit.prevent="save">
        <div class="form-field form-field--full">
          <SelectButton v-model="form.type" :options="types" option-label="label" option-value="value" :allow-empty="false" />
        </div>
        <div class="form-field">
          <label for="bl-title">Objet</label>
          <InputText id="bl-title" v-model="form.title" />
        </div>
        <div class="form-field">
          <label for="bl-date">Date</label>
          <DatePicker v-model="form.date" input-id="bl-date" date-format="dd/mm/yy" />
        </div>
        <div class="form-field form-field--full">
          <label>Lignes (sans prix)</label>
          <div v-for="(line, i) in form.lines" :key="i" class="bl-line">
            <InputText v-model="line.designation" placeholder="Désignation" class="grow" />
            <InputText :model-value="line.reference ?? ''" placeholder="Référence" @update:model-value="(v) => (line.reference = v || null)" />
            <InputNumber v-model="line.quantity" :min="0" :max-fraction-digits="2" class="qty" />
            <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="form.lines.splice(i, 1)" />
          </div>
          <div><Button label="Ajouter une ligne" icon="pi pi-plus" size="small" text @click="form.lines.push({ designation: '', reference: null, unit: null, quantity: 1 })" /></div>
        </div>
        <div class="form-field form-field--full">
          <label for="bl-done">Travaux réalisés</label>
          <Textarea id="bl-done" v-model="form.done" rows="3" auto-resize />
        </div>
        <div class="form-field form-field--full">
          <label for="bl-todo">Reste à faire</label>
          <Textarea id="bl-todo" v-model="form.todo" rows="2" auto-resize />
        </div>
        <label class="form-field--full switch"><ToggleSwitch v-model="form.show_logo" /> Logo sur le PDF</label>
      </form>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="open = false" />
        <Button label="Enregistrer" icon="pi pi-check" type="submit" form="bl-form" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.bl-line {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.375rem;
}

.grow {
  flex: 1;
}

.qty {
  width: 7rem;
}

.switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
