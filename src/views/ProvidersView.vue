<script setup lang="ts">
import ViewModeToggle from '@/components/ViewModeToggle.vue'
import CardGrid from '@/components/CardGrid.vue'
import { useViewMode } from '@/composables/useViewMode'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DataTable, { type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { Brand, Provider } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ClientLogo from '@/components/ClientLogo.vue'
import ProviderFormDialog from '@/components/stock/ProviderFormDialog.vue'

/** Fournisseurs et marques ; chacun a sa fiche avec ses articles. */
const auth = useAuthStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()

const tab = ref(route.query.tab === 'brands' ? 'brands' : 'providers')
const providers = ref<Provider[]>([])
const brands = ref<Brand[]>([])
const search = ref('')
const createOpen = ref(false)
const canCreate = computed(() => auth.canAny(['stock.create', 'purchases.create']))

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function loadProviders(): Promise<void> {
  try {
    providers.value = (await api.providers.list({ search: search.value || undefined, per_page: 100 })).data
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  }
}
async function loadBrands(): Promise<void> {
  brands.value = await api.brands.list(search.value || undefined).catch(() => [])
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => void Promise.all([loadProviders(), loadBrands()]), 300)
})
watch(tab, (t) => void router.replace({ query: { tab: t } }))
onMounted(() => void Promise.all([loadProviders(), loadBrands()]))

const viewMode = useViewMode('providers')
const openProvider = (e: DataTableRowClickEvent) => router.push({ name: 'provider', params: { id: (e.data as Provider).id } })
const openBrand = (e: DataTableRowClickEvent) => router.push({ name: 'brand', params: { id: (e.data as Brand).id } })

const newBrand = ref('')
async function addBrand(): Promise<void> {
  if (!newBrand.value.trim()) return
  try {
    const brand = await api.brands.create({ name: newBrand.value.trim() })
    newBrand.value = ''
    void router.push({ name: 'brand', params: { id: brand.id } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Marque refusée', detail: errorDetail(e), life: 5000 })
  }
}
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'stock' }" class="back"><i class="pi pi-arrow-left" /> Stock</RouterLink>
    <div class="page-header">
      <h1>Fournisseurs et marques</h1>
      <ViewModeToggle v-model="viewMode" class="view-toggle" />
      <Button v-if="canCreate && tab === 'providers'" label="Nouveau fournisseur" icon="pi pi-plus" @click="createOpen = true" />
      <form v-if="canCreate && tab === 'brands'" class="add-brand" @submit.prevent="addBrand">
        <InputText v-model="newBrand" placeholder="Nouvelle marque" />
        <Button type="submit" label="Ajouter" icon="pi pi-plus" :disabled="!newBrand.trim()" />
      </form>
    </div>

    <IconField class="search">
      <InputIcon class="pi pi-search" />
      <InputText v-model="search" :placeholder="tab === 'providers' ? 'Nom, contact, téléphone' : 'Nom de la marque'" />
    </IconField>

    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="providers">Fournisseurs</Tab>
        <Tab value="brands">Marques</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="providers">
          <CardGrid
            v-if="viewMode === 'cards'"
            :items="providers"
            empty-text="Aucun fournisseur."
            @open="(p) => router.push({ name: 'provider', params: { id: p.id } })"
          >
            <template #card="{ item }">
              <div class="card-head">
                <ClientLogo :name="item.name" :url="item.logo_url" :size="44" />
                <div>
                  <span class="card-title">{{ item.name }}</span>
                  <span class="card-sub">{{ item.contact_name ?? 'Fournisseur' }}</span>
                </div>
              </div>
              <div class="card-meta">
                <span v-if="item.phone"><i class="pi pi-phone" /> {{ item.phone }}</span>
                <span v-if="item.email"><i class="pi pi-envelope" /> {{ item.email }}</span>
                <span v-if="item.latitude !== null"><i class="pi pi-map-marker" /> Position enregistrée</span>
              </div>
              <div class="card-foot"><span class="muted"><i class="pi pi-box" /> {{ item.articles_count ?? 0 }} article(s)</span></div>
            </template>
          </CardGrid>
          <DataTable v-else :value="providers" data-key="id" row-hover class="clickable" @row-click="openProvider">
            <template #empty>Aucun fournisseur.</template>
            <Column style="width: 3.5rem"><template #body="{ data }"><ClientLogo :name="data.name" :url="data.logo_url" :size="36" /></template></Column>
            <Column header="Nom">
              <template #body="{ data }">
                <strong>{{ data.name }}</strong>
                <i v-if="data.latitude !== null" class="pi pi-map-marker muted located" title="Position enregistrée" />
              </template>
            </Column>
            <Column header="Contact">
              <template #body="{ data }">
                {{ data.contact_name ?? '' }}
                <div class="muted small">{{ [data.phone, data.email].filter(Boolean).join(' · ') }}</div>
              </template>
            </Column>
            <Column header="Articles" field="articles_count" style="width: 7rem" />
          </DataTable>
        </TabPanel>
        <TabPanel value="brands">
          <CardGrid
            v-if="viewMode === 'cards'"
            :items="brands"
            min-width="14rem"
            empty-text="Aucune marque."
            @open="(b) => router.push({ name: 'brand', params: { id: b.id } })"
          >
            <template #card="{ item }">
              <div class="card-head">
                <ClientLogo :name="item.name" :url="item.logo_url" :size="44" />
                <div>
                  <span class="card-title">{{ item.name }}</span>
                  <span v-if="item.website" class="card-sub">{{ item.website }}</span>
                </div>
              </div>
              <div class="card-foot"><span class="muted"><i class="pi pi-box" /> {{ item.articles_count ?? 0 }} article(s)</span></div>
            </template>
          </CardGrid>
          <DataTable v-else :value="brands" data-key="id" row-hover class="clickable" @row-click="openBrand">
            <template #empty>Aucune marque.</template>
            <Column style="width: 3.5rem"><template #body="{ data }"><ClientLogo :name="data.name" :url="data.logo_url" :size="36" /></template></Column>
            <Column header="Marque">
              <template #body="{ data }">
                <strong>{{ data.name }}</strong>
                <div v-if="data.website" class="muted small">{{ data.website }}</div>
              </template>
            </Column>
            <Column header="Articles" field="articles_count" style="width: 7rem" />
          </DataTable>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <ProviderFormDialog v-model:visible="createOpen" @saved="(p) => router.push({ name: 'provider', params: { id: p.id } })" />
  </div>
</template>

<style scoped>
.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.search {
  max-width: 24rem;
}

.add-brand {
  display: flex;
  gap: 0.5rem;
}

.clickable :deep(tbody tr) {
  cursor: pointer;
}

.located {
  margin-left: 0.375rem;
}

.small {
  font-size: 0.8rem;
}
</style>
