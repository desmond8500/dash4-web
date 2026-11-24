<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { alertText, fleetSeverity, formatKm, vehicleSubtitle } from '@dash4/shared'
import type { Vehicle, VehicleKind, VehicleOptions } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { alertLevel, vehicleIcon } from '@/utils/fleet'
import { searchOnly } from '@/utils/listSearch'
import { apiErrorMessage } from '@/utils/errors'
import VehicleFormDialog from '@/components/fleet/VehicleFormDialog.vue'

/** Parc automobile : véhicules et scooters, avec les papiers et entretiens à surveiller en tête. */
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const vehicles = ref<Vehicle[]>([])
const options = ref<VehicleOptions | null>(null)
const loading = ref(false)
const filter = ref<'all' | 'alerts'>(route.query.filtre === 'alertes' ? 'alerts' : 'all')
const kind = ref<VehicleKind | null>(null)
const search = ref('')
const createOpen = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    vehicles.value = await api.vehicles.list({ alerts: filter.value === 'alerts', kind: kind.value ?? undefined })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: apiErrorMessage(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  void load()
  options.value = await api.vehicles.options().catch(() => null)
})
watch([filter, kind], load)

const shown = computed(() =>
  searchOnly(vehicles.value, search.value, (v) => [v.name, v.plate, v.brand, v.model, v.driver?.full_name]).sort(
    (a, b) => alertLevel(b) - alertLevel(a) || a.name.localeCompare(b.name, 'fr', { numeric: true }),
  ),
)
const alertsCount = computed(() => vehicles.value.filter((v) => alertLevel(v) > 0).length)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Parc automobile</h1>
      <Button v-if="auth.can('vehicles.create')" label="Nouveau véhicule" icon="pi pi-plus" @click="createOpen = true" />
    </div>
    <div class="filters">
      <SelectButton
        v-model="filter"
        :options="[{ v: 'all', l: 'Tous' }, { v: 'alerts', l: `À surveiller${alertsCount && filter === 'all' ? ` (${alertsCount})` : ''}` }]"
        option-label="l"
        option-value="v"
        :allow-empty="false"
      />
      <Select v-model="kind" :options="[{ value: null, label: 'Tous les types' }, ...(options?.kinds ?? [])]" option-label="label" option-value="value" aria-label="Type" />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Nom, immatriculation, conducteur…" aria-label="Rechercher un véhicule" />
      </IconField>
    </div>

    <DataTable :value="shown" :loading="loading" data-key="id" row-hover class="clickable" @row-click="(e) => router.push({ name: 'vehicle', params: { id: e.data.id } })">
      <template #empty>{{ search || filter === 'alerts' ? 'Aucun véhicule ne correspond.' : 'Aucun véhicule dans le parc.' }}</template>
      <Column header="Véhicule">
        <template #body="{ data }">
          <div class="vehicle">
            <span class="thumb">
              <img v-if="data.photo_url" :src="data.photo_url" alt="" loading="lazy" />
              <i v-else :class="vehicleIcon(data.kind.value)" aria-hidden="true" />
            </span>
            <div>
              <strong>{{ data.name }}</strong>
              <div class="muted small">{{ vehicleSubtitle(data) || data.kind.label }}</div>
            </div>
          </div>
        </template>
      </Column>
      <Column header="Conducteur"><template #body="{ data }">{{ data.driver?.full_name ?? '—' }}</template></Column>
      <Column header="Compteur" style="width: 9rem"><template #body="{ data }">{{ formatKm(data.mileage) }}</template></Column>
      <Column header="État" style="width: 9rem">
        <template #body="{ data }"><Tag :value="data.status.label" :severity="data.status.value === 'active' ? 'success' : data.status.value === 'repair' ? 'warn' : 'secondary'" /></template>
      </Column>
      <Column header="À surveiller">
        <template #body="{ data }">
          <div class="alerts">
            <Tag v-for="(a, i) in data.alerts ?? []" :key="i" :value="alertText(a)" :severity="fleetSeverity(a.state)" />
            <span v-if="!(data.alerts ?? []).length" class="muted small">Rien à signaler</span>
          </div>
        </template>
      </Column>
    </DataTable>

    <VehicleFormDialog v-model:visible="createOpen" :vehicle="null" :options="options" @saved="(v) => router.push({ name: 'vehicle', params: { id: v.id } })" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 0.75rem;
}
.vehicle {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
.thumb {
  flex: none;
  width: 64px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-content-hover-background);
  border: 1px solid var(--p-content-border-color);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb i {
  font-size: 1.25rem;
  color: var(--p-primary-color);
}
.alerts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.small {
  font-size: 0.85rem;
}
:deep(.clickable tbody tr) {
  cursor: pointer;
}
</style>
