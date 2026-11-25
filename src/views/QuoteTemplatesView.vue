<script setup lang="ts">
import { matchesSearch } from '@/utils/listSearch'
import ListSearch from '@/components/ListSearch.vue'
import { markdownToText } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, formatMoney, QUOTE_LINE_CATEGORY_LABELS } from '@dash4/shared'
import type { Article, QuoteLineArticle, QuoteLineCategory, QuoteSystem, QuoteTemplateSummary } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { CATEGORY_ORDER, linePrice } from '@/utils/quotes'
import ArticlePicker from '@/components/stock/ArticlePicker.vue'

/** Systèmes (vidéosurveillance, alarme…) et modèles de devis. Gestion : quotes.update + costs.view. */
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()
const articleHref = (id: number) => router.resolve({ name: 'article', params: { id } }).href
const canManage = computed(() => auth.can('quotes.update') && auth.can('costs.view'))

const systems = ref<QuoteSystem[]>([])
const loose = ref<QuoteTemplateSummary[]>([])
// Recherche : un système s'affiche si son nom correspond (tous ses modèles) ou si l'un de ses modèles correspond
const query = ref('')
const shownSystems = computed(() =>
  !query.value.trim()
    ? systems.value
    : systems.value
        .map((s) => (matchesSearch(query.value, s.name, s.description) ? s : { ...s, templates: s.templates.filter((t) => matchesSearch(query.value, t.name, t.description)) }))
        .filter((s) => s.templates.length || matchesSearch(query.value, s.name, s.description)),
)
const shownLoose = computed(() => loose.value.filter((t) => !query.value.trim() || matchesSearch(query.value, t.name)))
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const catalog = await api.quoteTemplates.catalog()
    systems.value = catalog.systems
    loose.value = catalog.templates_without_system
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void settings.load()
  void load()
})

// Systèmes
const systemOpen = ref(false)
const systemEdited = ref<QuoteSystem | null>(null)
const systemForm = ref({ name: '', description: '' })

function openSystem(system: QuoteSystem | null): void {
  systemEdited.value = system
  systemForm.value = { name: system?.name ?? '', description: system?.description ?? '' }
  systemOpen.value = true
}

async function saveSystem(): Promise<void> {
  const payload = { name: systemForm.value.name.trim(), description: systemForm.value.description.trim() || null }
  try {
    if (systemEdited.value) await api.quoteTemplates.updateSystem(systemEdited.value.id, payload)
    else await api.quoteTemplates.createSystem(payload)
    systemOpen.value = false
    await load()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: (e as Error).message, life: 5000 })
  }
}

function removeSystem(system: QuoteSystem): void {
  confirm.require({
    header: 'Supprimer le système',
    message: `Supprimer « ${system.name} » ? Ses ${system.templates.length} modèle(s) sont gardés, « sans système ».`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.quoteTemplates.removeSystem(system.id)
      await load()
    },
  })
}

// Modèles
type Line = {
  article_id: number | null
  article?: QuoteLineArticle | null
  designation: string
  reference: string
  category: QuoteLineCategory
  unit: string
  quantity: number
  unit_cost: number
  coefficient: number
}
const categories = (Object.entries(QUOTE_LINE_CATEGORY_LABELS) as Array<[QuoteLineCategory, string]>).map(([value, label]) => ({ value, label }))
const templateOpen = ref(false)
const templateId = ref<number | null>(null)
const templateForm = ref({ name: '', description: '', system: null as number | null, lines: [] as Line[] })
const errors = ref<Record<string, string[]>>({})

const emptyLine = (): Line => ({ article_id: null, article: null, designation: '', reference: '', category: 'other', unit: '', quantity: 1, unit_cost: 0, coefficient: 1 })

/** Choix d'un article du stock pour une ligne : reprend sa désignation, sa catégorie, son unité et, avec costs.view, son coût et son coefficient. */
function linkArticle(line: Line, article: Article): void {
  line.article_id = article.id
  line.article = { id: article.id, designation: article.designation, reference: article.reference, image_url: article.image_url, quantity: article.quantity, unit: article.unit, deleted: false }
  line.designation = article.designation
  line.reference = article.reference ?? ''
  line.category = article.category.value
  line.unit = article.unit ?? ''
  if (auth.can('costs.view')) {
    line.unit_cost = article.unit_cost ?? 0
    line.coefficient = article.coefficient ?? 1
  }
}

function unlinkArticle(line: Line): void {
  line.article_id = null
  line.article = null
}

function categoryLabel(value: QuoteLineCategory): string {
  return categories.find((c) => c.value === value)?.label ?? value
}

// Ajout/modification d'une ligne via une modale (le tableau du modèle reste en lecture seule)
const lineModalOpen = ref(false)
const lineEditIndex = ref<number | null>(null)
const lineDraft = ref<Line>(emptyLine())

function openLineModal(index: number | null): void {
  lineEditIndex.value = index
  const existing = index === null ? undefined : templateForm.value.lines[index]
  lineDraft.value = existing ? { ...existing } : emptyLine()
  lineModalOpen.value = true
}

function saveLine(): void {
  if (!lineDraft.value.designation.trim()) return
  const line: Line = { ...lineDraft.value, designation: lineDraft.value.designation.trim(), reference: lineDraft.value.reference.trim() }
  if (lineEditIndex.value === null) templateForm.value.lines.push(line)
  else templateForm.value.lines.splice(lineEditIndex.value, 1, line)
  lineModalOpen.value = false
}

function removeLine(index: number): void {
  templateForm.value.lines.splice(index, 1)
}

async function openTemplate(id: number | null, systemId: number | null = null): Promise<void> {
  templateId.value = id
  errors.value = {}
  if (id) {
    const t = await api.quoteTemplates.get(id)
    templateForm.value = {
      name: t.name,
      description: t.description ?? '',
      system: t.quote_system_id,
      lines: t.lines.map((l) => ({
        article_id: l.article_id,
        article: l.article,
        designation: l.designation,
        reference: l.reference ?? '',
        category: l.category.value,
        unit: l.unit ?? '',
        quantity: l.quantity,
        unit_cost: l.unit_cost ?? 0,
        coefficient: l.coefficient ?? 1,
      })),
    }
  } else {
    templateForm.value = { name: '', description: '', system: systemId, lines: [] }
  }
  templateOpen.value = true
}

async function saveTemplate(): Promise<void> {
  const f = templateForm.value
  const payload = {
    name: f.name.trim(),
    description: f.description.trim() || null,
    quote_system_id: f.system,
    lines: f.lines
      .filter((l) => l.designation.trim())
      .map((l) => ({ ...l, designation: l.designation.trim(), reference: l.reference.trim() || null, unit: l.unit.trim() || null })),
  }
  try {
    if (templateId.value) await api.quoteTemplates.update(templateId.value, payload)
    else await api.quoteTemplates.create(payload)
    templateOpen.value = false
    toast.add({ severity: 'success', summary: 'Modèle enregistré', life: 2500 })
    await load()
  } catch (e) {
    if (e instanceof ApiError) errors.value = e.errors
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: (e as Error).message, life: 5000 })
  }
}

function removeTemplate(t: QuoteTemplateSummary): void {
  confirm.require({
    header: 'Supprimer le modèle',
    message: `Supprimer le modèle « ${t.name} » ? Les devis qui l'ont utilisé ne changent pas.`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.quoteTemplates.remove(t.id)
      await load()
    },
  })
}

// Tri des lignes par catégorie (même ordre que dans un devis)
const linesAlreadySorted = computed(() => {
  const order = templateForm.value.lines.map((l) => CATEGORY_ORDER.indexOf(l.category))
  return order.every((value, i) => i === 0 || order[i - 1]! <= value)
})
function sortLinesByCategory(): void {
  templateForm.value.lines = templateForm.value.lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.line.category) - CATEGORY_ORDER.indexOf(b.line.category) || a.index - b.index)
    .map(({ line }) => line)
}

const lineColumnCount = computed(
  () => 6 + (auth.can('costs.view') ? 2 : 0) + (auth.can('prices.view') ? 1 : 0) + (canManage.value ? 1 : 0),
)

const systemOptions = computed(() => [{ id: null, name: 'Sans système' }, ...systems.value])
const total = computed(() =>
  templateForm.value.lines.reduce((sum, l) => sum + linePrice(l.unit_cost, l.coefficient, l.quantity).total, 0),
)
</script>

<template>
  <div class="page">
    <RouterLink :to="{ name: 'quotes' }" class="back"><i class="pi pi-arrow-left" /> Devis</RouterLink>
    <div class="page-header">
      <h1>Modèles de devis</h1>
      <div v-if="canManage" class="actions">
        <Button label="Nouveau système" icon="pi pi-folder-plus" severity="secondary" @click="openSystem(null)" />
        <Button label="Nouveau modèle" icon="pi pi-plus" @click="openTemplate(null)" />
      </div>
    </div>
    <p class="muted">
      Un modèle est un ensemble de lignes prêtes à insérer dans un devis (« Insérer un modèle » sur la fiche devis).
      On peut aussi enregistrer une section d'un devis comme modèle (icône signet de la section).
    </p>

    <ListSearch v-if="systems.length + loose.length > 3" v-model="query" class="search" placeholder="Rechercher un système ou un modèle…" />

    <Card v-for="system in shownSystems" :key="system.id">
      <template #title>
        <div class="card-title">
          <span>{{ system.name }}</span>
          <span v-if="canManage" class="actions">
            <Button icon="pi pi-plus" label="Modèle" size="small" text @click="openTemplate(null, system.id)" />
            <Button icon="pi pi-pencil" size="small" text rounded aria-label="Modifier le système" @click="openSystem(system)" />
            <Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer le système" @click="removeSystem(system)" />
          </span>
        </div>
      </template>
      <template #content>
        <MarkdownView class="muted" :text="system.description" />
        <table v-if="system.templates.length" class="list">
          <tbody>
            <tr v-for="t in system.templates" :key="t.id">
              <td><strong>{{ t.name }}</strong><div v-if="t.description" class="muted small">{{ markdownToText(t.description) }}</div></td>
              <td class="muted">{{ t.lines_count }} ligne(s)</td>
              <td class="actions">
                <Button :icon="canManage ? 'pi pi-pencil' : 'pi pi-eye'" size="small" text rounded :aria-label="canManage ? 'Modifier' : 'Voir'" @click="openTemplate(t.id)" />
                <Button v-if="canManage" icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer" @click="removeTemplate(t)" />
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">Aucun modèle dans ce système.</p>
      </template>
    </Card>

    <Card v-if="shownLoose.length">
      <template #title>Sans système</template>
      <template #content>
        <table class="list">
          <tbody>
            <tr v-for="t in shownLoose" :key="t.id">
              <td><strong>{{ t.name }}</strong></td>
              <td class="muted">{{ t.lines_count }} ligne(s)</td>
              <td class="actions">
                <Button :icon="canManage ? 'pi pi-pencil' : 'pi pi-eye'" size="small" text rounded aria-label="Ouvrir" @click="openTemplate(t.id)" />
                <Button v-if="canManage" icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer" @click="removeTemplate(t)" />
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </Card>

    <p v-if="!loading && !systems.length && !loose.length" class="muted">Aucun modèle pour l'instant.</p>
    <p v-else-if="query.trim() && !shownSystems.length && !shownLoose.length" class="muted">Aucun système ni modèle ne correspond.</p>

    <Dialog v-model:visible="systemOpen" :header="systemEdited ? 'Modifier le système' : 'Nouveau système'" modal :style="{ width: '460px' }">
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label for="sys-name">Nom</label>
          <InputText id="sys-name" v-model="systemForm.name" placeholder="Ex. : Vidéosurveillance" autofocus />
        </div>
        <div class="form-field form-field--full">
          <label for="sys-desc">Description</label>
          <MarkdownEditor id="sys-desc" v-model="systemForm.description" rows="2" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="systemOpen = false" />
        <Button label="Enregistrer" icon="pi pi-check" :disabled="!systemForm.name.trim()" @click="saveSystem" />
      </template>
    </Dialog>

    <Dialog v-model:visible="templateOpen" :header="templateId ? 'Modèle' : 'Nouveau modèle'" modal :style="{ width: '1100px' }" :breakpoints="{ '1150px': '96vw' }">
      <div class="form-grid">
        <div class="form-field">
          <label for="tpl-name">Nom</label>
          <InputText id="tpl-name" v-model="templateForm.name" :disabled="!canManage" :invalid="!!errors.name" />
        </div>
        <div class="form-field">
          <label for="tpl-system">Système</label>
          <Select id="tpl-system" v-model="templateForm.system" :options="systemOptions" option-label="name" option-value="id" :disabled="!canManage" />
        </div>
        <div class="form-field form-field--full">
          <label for="tpl-desc">Description</label>
          <InputText id="tpl-desc" v-model="templateForm.description" :disabled="!canManage" />
        </div>
        <div class="form-field form-field--full">
          <div v-if="canManage" class="line-actions">
            <Button label="Ajouter une ligne" icon="pi pi-plus" size="small" text @click="openLineModal(null)" />
            <Button
              label="Trier par catégorie"
              icon="pi pi-sort-alt"
              size="small"
              text
              severity="secondary"
              :disabled="templateForm.lines.length < 2 || linesAlreadySorted"
              @click="sortLinesByCategory"
            />
          </div>
          <div class="table-wrap">
          <table class="list lines">
            <thead>
              <tr>
                <th class="thumb-col" aria-label="Article" />
                <th>Désignation</th><th>Référence</th><th style="width: 9rem">Catégorie</th><th class="num" style="width: 6rem">Qté</th><th style="width: 4.5rem">Unité</th>
                <template v-if="auth.can('costs.view')"><th class="num" style="width: 8rem">Coût</th><th class="num" style="width: 5.5rem">Coef.</th></template>
                <th v-if="auth.can('prices.view')" class="num" style="width: 8rem">Montant</th>
                <th v-if="canManage" style="width: 5rem" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(l, i) in templateForm.lines" :key="i">
                <td class="thumb-col">
                  <a
                    v-if="l.article"
                    :href="articleHref(l.article.id)"
                    target="_blank"
                    rel="noopener"
                    class="thumb"
                    :class="{ deleted: l.article.deleted }"
                    :title="`${l.article.designation} · voir l'article du stock`"
                  >
                    <img v-if="l.article.image_url" :src="l.article.image_url" :alt="l.article.designation" loading="lazy" />
                    <i v-else class="pi pi-box" />
                  </a>
                  <span v-else class="thumb thumb-empty"><i class="pi pi-box" /></span>
                </td>
                <td>{{ l.designation }}</td>
                <td class="muted">{{ l.reference }}</td>
                <td>{{ categoryLabel(l.category) }}</td>
                <td class="num">{{ l.quantity }}</td>
                <td>{{ l.unit }}</td>
                <template v-if="auth.can('costs.view')">
                  <td class="num">{{ formatMoney(l.unit_cost, settings.currency()) }}</td>
                  <td class="num">× {{ l.coefficient }}</td>
                </template>
                <td v-if="auth.can('prices.view')" class="num">{{ formatMoney(linePrice(l.unit_cost, l.coefficient, l.quantity).total, settings.currency()) }}</td>
                <td v-if="canManage" class="actions">
                  <Button icon="pi pi-pencil" text rounded size="small" aria-label="Modifier la ligne" @click="openLineModal(i)" />
                  <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Retirer la ligne" @click="removeLine(i)" />
                </td>
              </tr>
              <tr v-if="!templateForm.lines.length">
                <td :colspan="lineColumnCount" class="muted">Aucune ligne. {{ canManage ? '« Ajouter une ligne » pour commencer.' : '' }}</td>
              </tr>
            </tbody>
            <tfoot v-if="templateForm.lines.length && auth.can('prices.view') && auth.can('costs.view')">
              <tr class="strong"><td :colspan="8">Total hors taxes du modèle</td><td class="num">{{ formatMoney(total, settings.currency()) }}</td><td v-if="canManage" /></tr>
            </tfoot>
          </table>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Fermer" severity="secondary" text @click="templateOpen = false" />
        <Button v-if="canManage" label="Enregistrer" icon="pi pi-check" :disabled="!templateForm.name.trim()" @click="saveTemplate" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="lineModalOpen"
      :header="lineEditIndex === null ? 'Nouvelle ligne' : 'Modifier la ligne'"
      modal
      :style="{ width: '560px' }"
      :breakpoints="{ '600px': '96vw' }"
    >
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label>Article du stock</label>
          <div class="line-article">
            <a
              v-if="lineDraft.article"
              :href="articleHref(lineDraft.article.id)"
              target="_blank"
              rel="noopener"
              class="thumb"
              :class="{ deleted: lineDraft.article.deleted }"
              :title="`${lineDraft.article.designation} · voir l'article du stock`"
            >
              <img v-if="lineDraft.article.image_url" :src="lineDraft.article.image_url" :alt="lineDraft.article.designation" loading="lazy" />
              <i v-else class="pi pi-box" />
            </a>
            <ArticlePicker v-if="!lineDraft.article" placeholder="Lier un article du stock (optionnel)" class="full" @select="(a) => linkArticle(lineDraft, a)" />
            <Button v-else label="Délier" icon="pi pi-times" text rounded size="small" severity="secondary" @click="unlinkArticle(lineDraft)" />
          </div>
        </div>
        <div class="form-field form-field--full">
          <label for="l-designation">Désignation</label>
          <InputText id="l-designation" v-model="lineDraft.designation" class="full" autofocus />
        </div>
        <div class="form-field form-field--full">
          <label for="l-reference">Référence</label>
          <InputText id="l-reference" v-model="lineDraft.reference" class="full" />
        </div>
        <div class="form-field">
          <label for="l-category">Catégorie</label>
          <Select id="l-category" v-model="lineDraft.category" :options="categories" option-label="label" option-value="value" class="full" />
        </div>
        <div class="form-field">
          <label for="l-unit">Unité</label>
          <InputText id="l-unit" v-model="lineDraft.unit" class="full" />
        </div>
        <div class="form-field">
          <label for="l-qty">Quantité</label>
          <InputNumber id="l-qty" v-model="lineDraft.quantity" :min="0" :max-fraction-digits="2" class="full" input-class="num-input" />
        </div>
        <template v-if="auth.can('costs.view')">
          <div class="form-field">
            <label for="l-cost">Coût unitaire</label>
            <InputNumber id="l-cost" v-model="lineDraft.unit_cost" :min="0" class="full" input-class="num-input" />
          </div>
          <div class="form-field">
            <label for="l-coef">Coefficient</label>
            <InputNumber id="l-coef" v-model="lineDraft.coefficient" :min="0" :max-fraction-digits="4" class="full" input-class="num-input" />
          </div>
        </template>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="lineModalOpen = false" />
        <Button label="Enregistrer" icon="pi pi-check" :disabled="!lineDraft.designation.trim()" @click="saveLine" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.search {
  margin-bottom: 1rem;
}
.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.full {
  width: 100%;
}

.line-actions {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

/* Le tableau défile dans la fenêtre au lieu d'écraser désignation/référence */
.table-wrap {
  overflow-x: auto;
  max-width: 100%;
}

.lines {
  min-width: 54rem;
}

.lines td {
  padding: 0.25rem;
}

.lines th:nth-child(2) {
  min-width: 13rem;
}

.lines th:nth-child(3) {
  min-width: 10rem;
}

.thumb-col {
  width: 3.5rem;
}

.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-decoration: none;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumb.deleted {
  opacity: 0.5;
}

.thumb-empty {
  border-style: dashed;
}

.line-article {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.line-article .full {
  flex: 1;
}

:deep(.num-input) {
  text-align: right;
  width: 100%;
}
</style>
