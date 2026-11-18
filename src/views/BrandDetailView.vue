<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { Brand } from '@dash4/shared'
import { api } from '@/services/api'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import ArticleList from '@/components/stock/ArticleList.vue'
import LogoEditor from '@/components/stock/LogoEditor.vue'

/** Marque : logo, description, site, ses articles, liens et documents (comme dans Dash3). */
const props = defineProps<{ id: string }>()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const brand = ref<Brand | null>(null)
const loading = ref(true)
const notFound = ref(false)
const tab = ref('articles')
const form = ref({ name: '', description: '', website: '' })

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

function setBrand(b: Brand): void {
  brand.value = b
  form.value = { name: b.name, description: b.description ?? '', website: b.website ?? '' }
}

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    setBrand(await api.brands.get(Number(props.id)))
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

async function save(field: 'name' | 'description' | 'website'): Promise<void> {
  const b = brand.value
  if (!b) return
  const value = form.value[field].trim()
  if (field === 'name' && !value) {
    form.value.name = b.name
    return
  }
  try {
    setBrand(await api.brands.update(b.id, { [field]: field === 'name' ? value : value || null }))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: errorDetail(e), life: 5000 })
    setBrand(b)
  }
}
async function upload(file: File): Promise<void> {
  try {
    setBrand(await api.brands.uploadLogo(brand.value!.id, file, file.name))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Logo refusé', detail: errorDetail(e), life: 5000 })
  }
}
async function removeLogo(): Promise<void> {
  setBrand(await api.brands.removeLogo(brand.value!.id))
}
function remove(): void {
  const b = brand.value
  if (!b) return
  confirm.require({
    header: 'Supprimer la marque',
    message: `Supprimer la marque « ${b.name} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await api.brands.remove(b.id)
        void router.push({ name: 'providers', query: { tab: 'brands' } })
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Suppression impossible', detail: errorDetail(e), life: 5000 })
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !brand" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Cette marque n'existe pas ou a été supprimée.</p>
      <RouterLink :to="{ name: 'providers', query: { tab: 'brands' } }">Retour aux marques</RouterLink>
    </div>

    <template v-else-if="brand">
      <RouterLink :to="{ name: 'providers', query: { tab: 'brands' } }" class="back"><i class="pi pi-arrow-left" /> Marques</RouterLink>
      <div class="page-header">
        <h1>{{ brand.name }}</h1>
        <Button v-if="brand.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" :disabled="brand.articles_count > 0" :title="brand.articles_count ? 'Marque utilisée par des articles' : ''" @click="remove" />
      </div>

      <Card>
        <template #content>
          <div class="identity">
            <LogoEditor :name="brand.name" :url="brand.logo_url" :can-edit="brand.can.update" @upload="upload" @remove="removeLogo" />
            <div class="form-grid grow">
              <div class="form-field"><label for="b-name">Nom</label><InputText id="b-name" v-model="form.name" :disabled="!brand.can.update" @change="save('name')" /></div>
              <div class="form-field">
                <label for="b-web">Site web</label>
                <InputText id="b-web" v-model="form.website" placeholder="https://" :disabled="!brand.can.update" @change="save('website')" />
                <a v-if="brand.website" :href="brand.website" target="_blank" rel="noopener" class="small">Ouvrir le site</a>
              </div>
              <div class="form-field form-field--full">
                <label for="b-desc">Description</label>
                <Textarea id="b-desc" v-model="form.description" rows="2" auto-resize :disabled="!brand.can.update" @change="save('description')" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="articles">Articles <span class="count">{{ brand.articles_count }}</span></Tab>
          <Tab value="links">Liens</Tab>
          <Tab value="documents">Documents</Tab>
          <Tab value="notes">Notes</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="articles"><ArticleList :filters="{ brand_id: brand.id }" /></TabPanel>
          <TabPanel v-for="kind in (['links', 'documents', 'notes'] as const)" :key="kind" :value="kind">
            <AttachmentsPanel :kind="kind" type="brands" :id="brand.id" :can-add="brand.can.update" :can-manage="brand.can.delete" />
          </TabPanel>
        </TabPanels>
      </Tabs>
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

.identity {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
}

.grow {
  flex: 1;
  min-width: 18rem;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}

.small {
  font-size: 0.8rem;
}
</style>
