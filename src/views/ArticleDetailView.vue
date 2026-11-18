<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, formatMoney } from '@dash4/shared'
import type { Article, Project, StockMovementPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import ArticleFormDialog from '@/components/stock/ArticleFormDialog.vue'
import ArticlePicker from '@/components/stock/ArticlePicker.vue'
import MovementTable from '@/components/stock/MovementTable.vue'
import { formatQty, stockState } from '@/utils/stock'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const article = ref<Article | null>(null)
const loading = ref(true)
const notFound = ref(false)
const busy = ref(false)
const editOpen = ref(false)
const tab = ref('movements')
const imageInput = ref<HTMLInputElement | null>(null)
const projects = ref<Project[]>([])

const state = computed(() => (article.value ? stockState(article.value) : null))

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    article.value = await api.articles.get(Number(props.id))
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })
if (auth.canAny(['projects.view', 'projects.view.own'])) {
  api.projects.list({ per_page: 100 }).then((r) => (projects.value = r.data)).catch(() => undefined)
}

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function run(action: () => Promise<Article>, failure = 'Modification impossible'): Promise<boolean> {
  busy.value = true
  try {
    article.value = await action()
    return true
  } catch (e) {
    toast.add({ severity: 'error', summary: failure, detail: errorDetail(e), life: 5000 })
    return false
  } finally {
    busy.value = false
  }
}

// Mouvement
const move = reactive({ type: 'in' as StockMovementPayload['type'], quantity: 1 as number | null, reason: '', project_id: null as number | null })
const moveTypes = [
  { value: 'in', label: 'Entrée' },
  { value: 'out', label: 'Sortie' },
  { value: 'inventory', label: 'Inventaire' },
]
watch(
  () => move.type,
  (t) => (move.quantity = t === 'inventory' ? (article.value?.quantity ?? 0) : 1),
)
function submitMove(): void {
  const a = article.value
  if (!a || move.quantity === null) return
  const payload: StockMovementPayload = {
    client_uuid: crypto.randomUUID(),
    type: move.type,
    quantity: move.quantity,
    reason: move.reason.trim() || null,
    project_id: move.project_id,
  }
  void run(() => api.articles.move(a.id, payload), 'Mouvement refusé').then((ok) => {
    if (!ok) return
    toast.add({ severity: 'success', summary: 'Mouvement enregistré', detail: `Stock : ${formatQty(article.value?.quantity)} ${article.value?.unit ?? ''}`, life: 3000 })
    move.reason = ''
    move.quantity = move.type === 'inventory' ? (article.value?.quantity ?? 0) : 1
  })
}

// Image
function onImage(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && article.value) void run(() => api.articles.uploadImage(article.value!.id, file, file.name), 'Image refusée')
}

// Articles liés
function setDependencies(items: Array<{ article_id: number; quantity: number }>): void {
  if (article.value) void run(() => api.articles.setDependencies(article.value!.id, items))
}
const dependencyItems = () => (article.value?.dependencies ?? []).map((d) => ({ article_id: d.id, quantity: d.quantity }))
function addDependency(dep: Article): void {
  if (dep.id === article.value?.id || article.value?.dependencies?.some((d) => d.id === dep.id)) return
  setDependencies([...dependencyItems(), { article_id: dep.id, quantity: 1 }])
}
function updateDependency(id: number, quantity: number | null): void {
  if (!quantity) return
  setDependencies(dependencyItems().map((d) => (d.article_id === id ? { ...d, quantity } : d)))
}
const removeDependency = (id: number) => setDependencies(dependencyItems().filter((d) => d.article_id !== id))

function remove(): void {
  const a = article.value
  if (!a) return
  confirm.require({
    header: "Supprimer l'article",
    message: `Mettre « ${a.designation} » à la corbeille ? Ses mouvements restent dans l'historique.`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.articles.remove(a.id)
      void router.push({ name: 'stock' })
    },
  })
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !article" class="center"><ProgressSpinner /></div>
    <div v-else-if="notFound" class="center">
      <p>Cet article n'existe pas ou a été supprimé.</p>
      <RouterLink :to="{ name: 'stock' }">Retour au stock</RouterLink>
    </div>

    <template v-else-if="article">
      <RouterLink :to="{ name: 'stock' }" class="back"><i class="pi pi-arrow-left" /> Stock</RouterLink>

      <div class="page-header">
        <div class="title">
          <h1>{{ article.designation }}</h1>
          <Tag v-if="state" :value="state.label" :severity="state.severity" />
          <Tag v-if="!article.is_active" value="Inactif" severity="secondary" />
        </div>
        <div class="actions">
          <Button v-if="article.can.update" label="Modifier" icon="pi pi-pencil" severity="secondary" @click="editOpen = true" />
          <Button v-if="article.can.delete" icon="pi pi-trash" severity="danger" outlined aria-label="Supprimer" @click="remove" />
        </div>
      </div>

      <div class="layout">
        <div class="main">
          <Card>
            <template #content>
              <div class="identity">
                <div class="image">
                  <img v-if="article.image_url" :src="article.image_url" alt="" />
                  <i v-else class="pi pi-box" />
                  <div v-if="article.can.update" class="image-actions">
                    <Button :label="article.image_url ? 'Changer' : 'Ajouter une image'" size="small" text @click="imageInput?.click()" />
                    <Button v-if="article.image_url" label="Retirer" size="small" text severity="danger" @click="run(() => api.articles.removeImage(article!.id))" />
                    <input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onImage" />
                  </div>
                </div>
                <dl class="facts">
                  <dt>Référence</dt><dd>{{ article.reference ?? '—' }}</dd>
                  <dt>Code-barres</dt><dd>{{ article.barcode ?? '—' }}</dd>
                  <dt>Catégorie</dt><dd>{{ article.category.label }}</dd>
                  <dt>Marque</dt><dd><RouterLink v-if="article.brand" :to="{ name: 'brand', params: { id: article.brand.id } }">{{ article.brand.name }}</RouterLink><template v-else>—</template></dd>
                  <dt>Fournisseur</dt><dd><RouterLink v-if="article.provider" :to="{ name: 'provider', params: { id: article.provider.id } }">{{ article.provider.name }}</RouterLink><template v-else>—</template></dd>
                  <dt>Emplacement</dt><dd>{{ article.location ?? '—' }}</dd>
                  <template v-if="article.unit_cost !== undefined">
                    <dt>Coût d'achat</dt><dd>{{ formatMoney(article.unit_cost) }} × {{ article.coefficient?.toLocaleString('fr-FR') }}</dd>
                  </template>
                  <template v-if="article.unit_price !== undefined">
                    <dt>Prix de vente</dt><dd>{{ formatMoney(article.unit_price) }}</dd>
                  </template>
                </dl>
              </div>
              <p v-if="article.description" class="pre">{{ article.description }}</p>
            </template>
          </Card>

          <Tabs v-model:value="tab">
            <TabList>
              <Tab value="movements">Mouvements</Tab>
              <Tab value="dependencies">Articles liés <span v-if="article.dependencies?.length" class="count">{{ article.dependencies.length }}</span></Tab>
              <Tab value="documents">Documents</Tab>
              <Tab value="links">Liens</Tab>
              <Tab value="notes">Notes</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="movements">
                <MovementTable :movements="article.movements ?? []" />
                <RouterLink v-if="(article.movements?.length ?? 0) >= 50" :to="{ name: 'stock-movements', query: { article_id: article.id } }" class="small">
                  Voir tout l'historique
                </RouterLink>
              </TabPanel>
              <TabPanel value="dependencies">
                <div class="panel">
                  <p class="muted small">À prévoir avec cet article (support, connecteurs…).</p>
                  <table v-if="article.dependencies?.length" class="list">
                    <thead><tr><th>Article</th><th class="num">Quantité par unité</th><th class="num">En stock</th><th v-if="article.can.update" /></tr></thead>
                    <tbody>
                      <tr v-for="d in article.dependencies" :key="d.id">
                        <td><RouterLink :to="{ name: 'article', params: { id: d.id } }">{{ d.designation }}</RouterLink></td>
                        <td class="num">
                          <InputNumber v-if="article.can.update" :model-value="d.quantity" :min="0.01" :max-fraction-digits="2" input-class="qty-input" @update:model-value="(v) => updateDependency(d.id, v)" />
                          <template v-else>{{ formatQty(d.quantity) }}</template>
                        </td>
                        <td class="num">{{ formatQty(d.stock) }} {{ d.unit ?? '' }}</td>
                        <td v-if="article.can.update"><Button icon="pi pi-times" text rounded severity="danger" aria-label="Retirer" @click="removeDependency(d.id)" /></td>
                      </tr>
                    </tbody>
                  </table>
                  <ArticlePicker v-if="article.can.update" placeholder="Ajouter un article lié" @select="addDependency" />
                </div>
              </TabPanel>
              <TabPanel v-for="kind in (['documents', 'links', 'notes'] as const)" :key="kind" :value="kind">
                <AttachmentsPanel :kind="kind" type="articles" :id="article.id" :can-add="article.can.update" :can-manage="article.can.delete" />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        <aside class="side">
          <Card>
            <template #title>En stock</template>
            <template #content>
              <div class="quantity">
                <strong :class="{ alert: article.quantity <= 0 || article.is_low }">{{ formatQty(article.quantity) }}</strong>
                <span>{{ article.unit ?? '' }}</span>
              </div>
              <p class="muted small">
                <template v-if="article.min_quantity !== null">Seuil d'alerte : {{ formatQty(article.min_quantity) }}</template>
                <template v-else>Pas de seuil d'alerte.</template>
                <template v-if="article.stock_value !== undefined"> · Valeur : {{ formatMoney(article.stock_value) }}</template>
              </p>

              <form v-if="article.can.move" class="move" @submit.prevent="submitMove">
                <SelectButton v-model="move.type" :options="moveTypes" option-label="label" option-value="value" :allow-empty="false" />
                <div class="form-field">
                  <label for="m-qty">{{ move.type === 'inventory' ? 'Quantité comptée' : 'Quantité' }}</label>
                  <InputNumber v-model="move.quantity" input-id="m-qty" :min="0" :max-fraction-digits="2" :suffix="article.unit ? ` ${article.unit}` : ''" />
                </div>
                <div class="form-field">
                  <label for="m-reason">Motif</label>
                  <InputText id="m-reason" v-model="move.reason" :placeholder="move.type === 'out' ? 'Chantier, casse…' : move.type === 'in' ? 'Retour chantier…' : 'Inventaire'" />
                </div>
                <div v-if="projects.length && move.type !== 'inventory'" class="form-field">
                  <label for="m-project">Projet</label>
                  <Select id="m-project" v-model="move.project_id" :options="[{ id: null, name: 'Aucun' }, ...projects]" option-label="name" option-value="id" filter />
                </div>
                <Button type="submit" label="Enregistrer" icon="pi pi-check" :loading="busy" :disabled="move.quantity === null || (move.type !== 'inventory' && !move.quantity)" />
              </form>
            </template>
          </Card>
        </aside>
      </div>

      <ArticleFormDialog v-model:visible="editOpen" :article="article" @saved="(a) => (article = { ...a })" />
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

.title,
.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.title h1 {
  margin: 0;
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

.identity {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.image {
  width: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image img {
  width: 160px;
  height: 160px;
  object-fit: contain;
}

.image > .pi {
  font-size: 4rem;
  color: var(--p-text-muted-color);
  padding: 2rem;
}

.image-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
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

.quantity {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.quantity strong {
  font-size: 2.25rem;
}

.quantity strong.alert {
  color: var(--p-red-500);
}

.move {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}

.small {
  font-size: 0.85rem;
}

:deep(.qty-input) {
  width: 6rem;
}
</style>
