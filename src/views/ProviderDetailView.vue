<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, formatMoney } from '@dash4/shared'
import type { Provider, Purchase } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import CommentsPanel from '@/components/CommentsPanel.vue'
import ArticleList from '@/components/stock/ArticleList.vue'
import LogoEditor from '@/components/stock/LogoEditor.vue'
import ProviderFormDialog from '@/components/stock/ProviderFormDialog.vue'
import PurchaseCreateDialog from '@/components/stock/PurchaseCreateDialog.vue'
import { formatDate } from '@/utils/projects'
import { purchaseStatusSeverity } from '@/utils/stock'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const provider = ref<Provider | null>(null)
const purchases = ref<Purchase[]>([])
const commentsCount = ref(0)
const loading = ref(true)
const notFound = ref(false)
const editOpen = ref(false)
const purchaseOpen = ref(false)
const tab = ref(useRoute().query.onglet === 'commentaires' ? 'comments' : 'articles')
const canPurchases = computed(() => auth.canAny(['purchases.view', 'purchases.view.own']))
const mapUrl = computed(() =>
  provider.value?.latitude != null && provider.value.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${provider.value.latitude}&mlon=${provider.value.longitude}#map=17/${provider.value.latitude}/${provider.value.longitude}`
    : null,
)
const directionsUrl = computed(() =>
  provider.value?.latitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${provider.value.latitude},${provider.value.longitude}` : null,
)

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    provider.value = await api.providers.get(Number(props.id))
    if (canPurchases.value) purchases.value = (await api.purchases.list({ provider_id: provider.value.id, per_page: 50 })).data
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

async function upload(file: File): Promise<void> {
  try {
    provider.value = await api.providers.uploadLogo(provider.value!.id, file, file.name)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Logo refusé', detail: errorDetail(e), life: 5000 })
  }
}
async function removeLogo(): Promise<void> {
  provider.value = await api.providers.removeLogo(provider.value!.id)
}
function remove(): void {
  const p = provider.value
  if (!p) return
  confirm.require({
    header: 'Supprimer le fournisseur',
    message: `Mettre « ${p.name} » à la corbeille ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.providers.remove(p.id)
      void router.push({ name: 'providers' })
    },
  })
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !provider" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Ce fournisseur n'existe pas ou a été supprimé.</p>
      <RouterLink :to="{ name: 'providers' }">Retour aux fournisseurs</RouterLink>
    </div>

    <template v-else-if="provider">
      <RouterLink :to="{ name: 'providers' }" class="back"><i class="pi pi-arrow-left" /> Fournisseurs et marques</RouterLink>
      <div class="page-header">
        <h1>{{ provider.name }}</h1>
        <div class="actions">
          <Button v-if="auth.can('purchases.create')" label="Nouvel achat" icon="pi pi-shopping-cart" @click="purchaseOpen = true" />
          <Button v-if="provider.can.update" label="Modifier" icon="pi pi-pencil" severity="secondary" @click="editOpen = true" />
          <Button v-if="provider.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" @click="remove" />
        </div>
      </div>

      <Card>
        <template #content>
          <div class="identity">
            <LogoEditor :name="provider.name" :url="provider.logo_url" :can-edit="provider.can.update" @upload="upload" @remove="removeLogo" />
            <dl class="facts">
              <dt>Contact</dt><dd>{{ provider.contact_name ?? '—' }}</dd>
              <dt>Téléphone</dt><dd><a v-if="provider.phone" :href="`tel:${provider.phone}`">{{ provider.phone }}</a><template v-else>—</template></dd>
              <dt>E-mail</dt><dd><a v-if="provider.email" :href="`mailto:${provider.email}`">{{ provider.email }}</a><template v-else>—</template></dd>
              <dt>Site web</dt><dd><a v-if="provider.website" :href="provider.website" target="_blank" rel="noopener">{{ provider.website }}</a><template v-else>—</template></dd>
              <dt>Adresse</dt><dd class="pre">{{ provider.address ?? '—' }}</dd>
              <dt>Localisation</dt>
              <dd>
                <template v-if="mapUrl">
                  <a :href="mapUrl" target="_blank" rel="noopener"><i class="pi pi-map-marker" /> Voir sur la carte</a>
                  · <a :href="directionsUrl!" target="_blank" rel="noopener">Itinéraire</a>
                  <span class="muted small"> ({{ provider.latitude }}, {{ provider.longitude }})</span>
                </template>
                <template v-else>—</template>
              </dd>
            </dl>
          </div>
          <MarkdownView :text="provider.description" />
        </template>
      </Card>

      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="articles">Articles <span class="count">{{ provider.articles_count }}</span></Tab>
          <Tab v-if="canPurchases" value="purchases">Achats <span class="count">{{ purchases.length }}</span></Tab>
          <Tab value="documents">Documents</Tab>
          <Tab value="links">Liens</Tab>
          <Tab value="comments">Commentaires <span v-if="commentsCount" class="count">{{ commentsCount }}</span></Tab>
          <Tab value="notes">Notes</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="articles"><ArticleList :filters="{ provider_id: provider.id }" /></TabPanel>
          <TabPanel v-if="canPurchases" value="purchases">
            <table v-if="purchases.length" class="list">
              <thead><tr><th>Numéro</th><th>Objet</th><th>Commandé le</th><th>Statut</th><th v-if="auth.can('costs.view')" class="num">Total</th></tr></thead>
              <tbody>
                <tr v-for="p in purchases" :key="p.id" class="clickable" @click="router.push({ name: 'purchase', params: { id: p.id } })">
                  <td><strong>{{ p.number }}</strong></td>
                  <td>{{ p.title ?? '' }}</td>
                  <td>{{ formatDate(p.ordered_at) }}</td>
                  <td><Tag :value="p.status.label" :severity="purchaseStatusSeverity(p.status.value)" /></td>
                  <td v-if="auth.can('costs.view')" class="num">{{ p.total !== undefined ? formatMoney(p.total) : '' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted">Aucun achat chez ce fournisseur.</p>
          </TabPanel>
          <TabPanel value="comments"><CommentsPanel type="providers" :id="provider.id" @changed="commentsCount = $event" /></TabPanel>
          <TabPanel v-for="kind in (['documents', 'links', 'notes'] as const)" :key="kind" :value="kind">
            <AttachmentsPanel :kind="kind" type="providers" :id="provider.id" :can-add="provider.can.update" :can-manage="provider.can.delete" />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ProviderFormDialog v-model:visible="editOpen" :provider="provider" @saved="(p) => (provider = p)" />
      <PurchaseCreateDialog v-model:visible="purchaseOpen" :provider-id="provider.id" @created="(p) => router.push({ name: 'purchase', params: { id: p.id } })" />
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
  flex-wrap: wrap;
}

.identity {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.375rem 1rem;
  margin: 0;
}

.facts dt {
  color: var(--p-text-muted-color);
}

.facts dd {
  margin: 0;
}

.pre {
  white-space: pre-wrap;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}

tr.clickable {
  cursor: pointer;
}

.small {
  font-size: 0.8rem;
}
</style>
