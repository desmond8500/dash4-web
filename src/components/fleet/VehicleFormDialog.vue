<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { ApiError } from '@dash4/shared'
import type { Assignee, Vehicle, VehicleCharacteristic, VehicleOptions, VehiclePayload } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { fromApiDate, toApiDate } from '@/utils/projects'
import { intOrNull } from '@/utils/fleet'

/** Création ou modification d'un véhicule : identité, caractéristiques libres, conducteur, révision. */
const props = defineProps<{ vehicle: Vehicle | null; options: VehicleOptions | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [vehicle: Vehicle] }>()
const auth = useAuthStore()

const people = ref<Assignee[]>([])
const error = ref<string | null>(null)
const saving = ref(false)
const blank = () => ({
  kind: 'car' as NonNullable<VehiclePayload['kind']>, name: '', brand: '', model: '', plate: '', vin: '', year: null as number | null, color: '',
  fuel: null as VehiclePayload['fuel'], fiscal_power: null as number | null, seats: null as number | null, status: 'active' as NonNullable<VehiclePayload['status']>,
  driver_id: null as number | null, acquired: null as Date | null, purchase_price: null as number | null, mileage: null as number | null,
  service_interval_km: null as number | null, service_interval_months: null as number | null, notes: '',
})
const form = ref(blank())
const characteristics = ref<VehicleCharacteristic[]>([])
const canCosts = computed(() => auth.can('costs.view'))

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  const v = props.vehicle
  form.value = v
    ? {
        kind: v.kind.value, name: v.name, brand: v.brand ?? '', model: v.model ?? '', plate: v.plate ?? '', vin: v.vin ?? '', year: v.year, color: v.color ?? '',
        fuel: v.fuel?.value ?? null, fiscal_power: v.fiscal_power, seats: v.seats, status: v.status.value, driver_id: v.driver_id,
        acquired: fromApiDate(v.acquired_on), purchase_price: v.purchase_price ?? null, mileage: null,
        service_interval_km: v.service_interval_km, service_interval_months: v.service_interval_months, notes: v.notes ?? '',
      }
    : blank()
  characteristics.value = (v?.characteristics ?? []).map((c) => ({ ...c }))
  if (!people.value.length) people.value = await api.assignees.list().catch(() => [])
})

function addCharacteristic(): void {
  characteristics.value = [...characteristics.value, { label: '', value: '' }]
}

async function save(): Promise<void> {
  const f = form.value
  if (!f.name.trim()) return void (error.value = 'Donnez un nom au véhicule (ex. « Scooter livraison 2 »).')
  const payload: VehiclePayload = {
    kind: f.kind, name: f.name.trim(), brand: f.brand.trim() || null, model: f.model.trim() || null, plate: f.plate.trim().toUpperCase() || null,
    vin: f.vin.trim() || null, year: intOrNull(f.year), color: f.color.trim() || null, fuel: f.fuel, fiscal_power: intOrNull(f.fiscal_power),
    seats: intOrNull(f.seats), status: f.status, driver_id: f.driver_id, acquired_on: toApiDate(f.acquired),
    service_interval_km: intOrNull(f.service_interval_km), service_interval_months: intOrNull(f.service_interval_months), notes: f.notes.trim() || null,
    characteristics: characteristics.value.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), value: c.value?.trim() || null })),
    ...(canCosts.value ? { purchase_price: intOrNull(f.purchase_price) } : {}),
  }
  saving.value = true
  error.value = null
  try {
    const saved = props.vehicle
      ? await api.vehicles.update(props.vehicle.id, payload)
      : await api.vehicles.create({ ...payload, name: payload.name!, kind: f.kind, ...(f.mileage !== null ? { mileage: intOrNull(f.mileage)! } : {}) })
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.vehicle ? 'Modifier le véhicule' : 'Nouveau véhicule'" modal :style="{ width: '720px' }" :breakpoints="{ '760px': '96vw' }">
    <form id="vehicle-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field"><label for="v-kind">Type</label><Select id="v-kind" v-model="form.kind" :options="props.options?.kinds ?? []" option-label="label" option-value="value" /></div>
      <div class="form-field"><label for="v-name">Nom</label><InputText id="v-name" v-model="form.name" placeholder="Scooter livraison 2" /></div>
      <div class="form-field"><label for="v-brand">Marque</label><InputText id="v-brand" v-model="form.brand" /></div>
      <div class="form-field"><label for="v-model">Modèle</label><InputText id="v-model" v-model="form.model" /></div>
      <div class="form-field"><label for="v-plate">Immatriculation</label><InputText id="v-plate" v-model="form.plate" placeholder="DK-1234-AB" /></div>
      <div class="form-field"><label for="v-vin">N° de châssis</label><InputText id="v-vin" v-model="form.vin" /></div>
      <div class="form-field"><label for="v-year">Année</label><InputNumber v-model="form.year" input-id="v-year" :use-grouping="false" :min="1950" :max="2100" /></div>
      <div class="form-field"><label for="v-color">Couleur</label><InputText id="v-color" v-model="form.color" /></div>
      <div class="form-field"><label for="v-fuel">Énergie</label><Select id="v-fuel" v-model="form.fuel" :options="[{ value: null, label: '—' }, ...(props.options?.fuels ?? [])]" option-label="label" option-value="value" /></div>
      <div class="form-field"><label for="v-cv">Puissance fiscale (CV)</label><InputNumber v-model="form.fiscal_power" input-id="v-cv" :min="0" /></div>
      <div class="form-field"><label for="v-seats">Places</label><InputNumber v-model="form.seats" input-id="v-seats" :min="0" /></div>
      <div class="form-field"><label for="v-status">État</label><Select id="v-status" v-model="form.status" :options="props.options?.statuses ?? []" option-label="label" option-value="value" /></div>
      <div class="form-field">
        <label for="v-driver">Conducteur attitré</label>
        <Select id="v-driver" v-model="form.driver_id" :options="[{ id: null, full_name: 'Aucun (véhicule partagé)' }, ...people]" option-label="full_name" option-value="id" filter />
      </div>
      <div class="form-field"><label for="v-acq">Mis en service le</label><DatePicker v-model="form.acquired" input-id="v-acq" date-format="dd/mm/yy" show-button-bar /></div>
      <div v-if="canCosts" class="form-field"><label for="v-price">Prix d'achat</label><InputNumber v-model="form.purchase_price" input-id="v-price" :min="0" suffix=" F" /></div>
      <div v-if="!props.vehicle" class="form-field"><label for="v-km">Kilométrage actuel</label><InputNumber v-model="form.mileage" input-id="v-km" :min="0" suffix=" km" /></div>
      <div class="form-field"><label for="v-ikm">Révision tous les… (km)</label><InputNumber v-model="form.service_interval_km" input-id="v-ikm" :min="100" suffix=" km" /></div>
      <div class="form-field"><label for="v-imo">… ou tous les (mois)</label><InputNumber v-model="form.service_interval_months" input-id="v-imo" :min="1" :max="60" suffix=" mois" /></div>

      <div class="form-field form-field--full">
        <label>Autres caractéristiques</label>
        <div v-for="(c, i) in characteristics" :key="i" class="char-row">
          <InputText v-model="c.label" placeholder="Cylindrée, pneus, boîte…" aria-label="Caractéristique" />
          <InputText :model-value="c.value ?? ''" placeholder="Valeur" aria-label="Valeur" @update:model-value="(v) => (c.value = v ?? '')" />
          <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="characteristics.splice(i, 1)" />
        </div>
        <Button label="Ajouter une caractéristique" icon="pi pi-plus" text size="small" @click="addCharacteristic" />
      </div>
      <div class="form-field form-field--full"><label for="v-notes">Notes</label><MarkdownEditor id="v-notes" v-model="form.notes" rows="3" /></div>
    </form>
    <template #footer>
      <Button label="Annuler" text severity="secondary" @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="vehicle-form" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.char-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}
</style>
