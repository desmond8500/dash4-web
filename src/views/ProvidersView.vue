<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { Brand, Provider } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/** Fournisseurs et marques. */
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const tab = ref('providers')
const providers = ref<Provider[]>([])
const brands = ref<Brand[]>([])
const search = ref('')
const canCreate = computed(() => auth.canAny(['stock.create', 'purchases.create']))
const canUpdate = computed(() => auth.canAny(['stock.update', 'purchases.update']))
const canDelete = computed(() => auth.canAny(['stock.delete', 'purchases.delete']))

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function loadProviders(): Promise<void> {
  try {
    providers.value = (await api.providers.list({ search: search.value || undefined, per_page: 100 })).data
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  }
}
async function loadBrands(): Promise<void> {
  brands.value = await api.brands.list().catch(() => [])
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(loadProviders, 300)
})
onMounted(() => void Promise.all([loadProviders(), loadBrands()]))

// Fournisseur
const providerOpen = ref(false)
const editedProvider = ref<Provider | null>(null)
const pForm = reactive({ name: '', contact_name: '', phone: '', email: '', address: '', website: '', description: '' })
const pError = ref<string | null>(null)
function openProvider(p: Provider | null): void {
  editedProvider.value = p
  pError.value = null
  Object.assign(pForm, {
    name: p?.name ?? '',
    contact_name: p?.contact_name ?? '',
    phone: p?.phone ?? '',
    email: p?.email ?? '',
    address: p?.address ?? '',
    website: p?.website ?? '',
    description: p?.description ?? '',
  })
  providerOpen.value = true
}
async function saveProvider(): Promise<void> {
  const t = (v: string) => v.trim() || null
  const payload = {
    name: pForm.name.trim(),
    contact_name: t(pForm.contact_name),
    phone: t(pForm.phone),
    email: t(pForm.email),
    address: t(pForm.address),
    website: t(pForm.website),
    description: t(pForm.description),
  }
  try {
    if (editedProvider.value) await api.providers.update(editedProvider.value.id, payload)
    else await api.providers.create({ ...payload, client_uuid: crypto.randomUUID() })
    providerOpen.value = false
    void loadProviders()
  } catch (e) {
    pError.value = errorDetail(e)
  }
}
function removeProvider(p: Provider): void {
  confirm.require({
    header: 'Supprimer le fournisseur',
    message: `Mettre « ${p.name} » à la corbeille ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.providers.remove(p.id).catch((e) => toast.add({ severity: 'error', summary: 'Suppression impossible', detail: errorDetail(e), life: 5000 }))
      void loadProviders()
    },
  })
}

// Marques
const newBrand = ref('')
async function addBrand(): Promise<void> {
  if (!newBrand.value.trim()) return
  try {
    await api.brands.create({ name: newBrand.value.trim() })
    newBrand.value = ''
    void loadBrands()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Marque refusée', detail: errorDetail(e), life: 5000 })
  }
}
async function renameBrand(b: Brand, name: string): Promise<void> {
  if (!name.trim() || name.trim() === b.name) return
  await api.brands.update(b.id, { name: name.trim() }).catch((e) => toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 }))
  void loadBrands()
}
async function removeBrand(b: Brand): Promise<void> {
  try {
    await api.brands.remove(b.id)
    void loadBrands()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Suppression impossible', detail: errorDetail(e), life: 5000 })
  }
}
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'stock' }" class="back"><i class="pi pi-arrow-left" /> Stock</RouterLink>
    <div class="page-header">
      <h1>Fournisseurs et marques</h1>
      <Button v-if="canCreate && tab === 'providers'" label="Nouveau fournisseur" icon="pi pi-plus" @click="openProvider(null)" />
    </div>

    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="providers">Fournisseurs</Tab>
        <Tab value="brands">Marques</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="providers">
          <IconField class="search">
            <InputIcon class="pi pi-search" />
            <InputText v-model="search" placeholder="Nom, contact, téléphone" />
          </IconField>
          <DataTable :value="providers" data-key="id">
            <template #empty>Aucun fournisseur.</template>
            <Column field="name" header="Nom" />
            <Column header="Contact">
              <template #body="{ data }">
                {{ data.contact_name ?? '' }}
                <div class="muted small">{{ [data.phone, data.email].filter(Boolean).join(' · ') }}</div>
              </template>
            </Column>
            <Column header="Articles" style="width: 7rem">
              <template #body="{ data }">
                <a v-if="data.articles_count" href="#" @click.prevent="router.push({ name: 'stock', query: { provider_id: data.id } })">{{ data.articles_count }}</a>
                <template v-else>0</template>
              </template>
            </Column>
            <Column style="width: 7rem">
              <template #body="{ data }">
                <Button v-if="canUpdate" icon="pi pi-pencil" text rounded aria-label="Modifier" @click="openProvider(data)" />
                <Button v-if="canDelete" icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="removeProvider(data)" />
              </template>
            </Column>
          </DataTable>
        </TabPanel>
        <TabPanel value="brands">
          <div class="panel">
            <table v-if="brands.length" class="list">
              <thead><tr><th>Marque</th><th class="num">Articles</th><th v-if="canDelete" /></tr></thead>
              <tbody>
                <tr v-for="b in brands" :key="b.id">
                  <td>
                    <InputText v-if="canUpdate" :model-value="b.name" @change="renameBrand(b, ($event.target as HTMLInputElement).value)" />
                    <template v-else>{{ b.name }}</template>
                  </td>
                  <td class="num">{{ b.articles_count }}</td>
                  <td v-if="canDelete">
                    <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" :disabled="b.articles_count > 0" :title="b.articles_count ? 'Marque utilisée par des articles' : ''" @click="removeBrand(b)" />
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted">Aucune marque.</p>
            <form v-if="canCreate" class="add" @submit.prevent="addBrand">
              <InputText v-model="newBrand" placeholder="Nouvelle marque" />
              <Button type="submit" label="Ajouter" icon="pi pi-plus" size="small" :disabled="!newBrand.trim()" />
            </form>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <Dialog v-model:visible="providerOpen" :header="editedProvider ? 'Modifier le fournisseur' : 'Nouveau fournisseur'" modal :style="{ width: '560px' }" :breakpoints="{ '600px': '95vw' }">
      <form id="provider-form" class="form-grid" @submit.prevent="saveProvider">
        <Message v-if="pError" class="form-field--full" severity="error" :closable="false">{{ pError }}</Message>
        <div class="form-field form-field--full"><label for="p-name">Nom</label><InputText id="p-name" v-model="pForm.name" autofocus /></div>
        <div class="form-field"><label for="p-contact">Contact</label><InputText id="p-contact" v-model="pForm.contact_name" /></div>
        <div class="form-field"><label for="p-phone">Téléphone</label><InputText id="p-phone" v-model="pForm.phone" /></div>
        <div class="form-field"><label for="p-email">E-mail</label><InputText id="p-email" v-model="pForm.email" type="email" /></div>
        <div class="form-field"><label for="p-web">Site web</label><InputText id="p-web" v-model="pForm.website" placeholder="https://" /></div>
        <div class="form-field form-field--full"><label for="p-address">Adresse</label><Textarea id="p-address" v-model="pForm.address" rows="2" auto-resize /></div>
        <div class="form-field form-field--full"><label for="p-desc">Notes</label><Textarea id="p-desc" v-model="pForm.description" rows="2" auto-resize /></div>
      </form>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="providerOpen = false" />
        <Button label="Enregistrer" icon="pi pi-check" type="submit" form="provider-form" :disabled="!pForm.name.trim()" />
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

.search {
  margin-bottom: 0.75rem;
  max-width: 24rem;
}

.small {
  font-size: 0.8rem;
}
</style>
