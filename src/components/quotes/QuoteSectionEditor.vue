<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'
import { useRouter } from 'vue-router'
import { formatMoney, QUOTE_LINE_CATEGORY_LABELS } from '@dash4/shared'
import type { Currency, QuoteLine, QuoteLineCategory, QuoteLinePayload, QuoteSection } from '@dash4/shared'
import { linePrice, sortedByCategory } from '@/utils/quotes'
import { useAuthStore } from '@/stores/auth'
import ArticlePicker from '@/components/stock/ArticlePicker.vue'
import type { Article } from '@dash4/shared'

/**
 * Une section du devis et ses lignes, modifiables sur place.
 * Chaque changement part tout de suite à l'API, qui renvoie le devis recalculé.
 */
const props = defineProps<{
  section: QuoteSection
  sections: QuoteSection[]
  editable: boolean
  editPrices: boolean
  showPrices: boolean
  /** Le texte de proposition technique reste modifiable sur un devis accepté. */
  canEditProposal: boolean
  canSaveTemplate: boolean
  currency: Currency
  first: boolean
  last: boolean
  /** Formulaires des lignes ouverts (réglage général du devis ; chaque section peut le changer). */
  forms?: boolean
  /** Lier une ligne à un article du stock (aussi sur un devis accepté). */
  canLink?: boolean
}>()
const emit = defineEmits<{
  updateSection: [payload: { title?: string; is_visible?: boolean }]
  removeSection: []
  moveSection: [direction: -1 | 1]
  addLine: [payload: QuoteLinePayload]
  updateLine: [lineId: number, payload: Partial<QuoteLinePayload>]
  removeLine: [lineId: number]
  orderLines: [ids: number[]]
  saveProposal: [text: string | null]
  saveAsTemplate: []
  linkArticle: [lineId: number, articleId: number | null]
}>()

const router = useRouter()

// Lecture ou formulaires : en lecture, les lignes sont un tableau simple, plus lisible
const formsOpen = ref(props.forms ?? false)

// Section en plein écran, pour lire et modifier les longues sections confortablement (Échap pour sortir)
const fullscreen = ref(false)
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && fullscreen.value && !document.querySelector('.p-dialog-mask, .p-overlay-mask')) fullscreen.value = false
}
watch(fullscreen, (on) => {
  document.body.classList.toggle('no-scroll', on)
  if (on) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (fullscreen.value) document.body.classList.remove('no-scroll')
})
watch(() => props.forms, (v) => (formsOpen.value = v ?? false))
const showForms = computed(() => props.editable && formsOpen.value)
const columns = computed(() => 5 + (props.editPrices ? 2 : 0) + (props.showPrices ? 2 : 0) + (props.editable || props.canLink ? 1 : 0))

// Article du stock lié : photo à gauche, fiche dans un nouvel onglet
const articleHref = (id: number) => router.resolve({ name: 'article', params: { id } }).href
const linkFor = ref<QuoteLine | null>(null)
function pickLinked(article: Article): void {
  if (linkFor.value) emit('linkArticle', linkFor.value.id, article.id)
  linkFor.value = null
}

const categories = (Object.entries(QUOTE_LINE_CATEGORY_LABELS) as Array<[QuoteLineCategory, string]>).map(
  ([value, label]) => ({ value, label }),
)

const title = ref(props.section.title)
watch(() => props.section.title, (t) => (title.value = t))

// Proposition technique de la section
const proposal = ref(props.section.proposal ?? '')
const proposalOpen = ref(!!props.section.proposal)
watch(() => props.section.proposal, (p) => (proposal.value = p ?? ''))
function saveProposal(): void {
  const text = proposal.value.trim()
  if (text === (props.section.proposal ?? '').trim()) return
  emit('saveProposal', text || null)
}

// Copie modifiable des lignes, remise à jour à chaque réponse de l'API
type Draft = { designation: string; reference: string; category: QuoteLineCategory; unit: string; quantity: number; unit_cost: number; coefficient: number }
const drafts = ref<Record<number, Draft>>({})
watch(
  () => props.section.lines,
  (lines) => {
    drafts.value = Object.fromEntries(
      lines.map((l) => [
        l.id,
        {
          designation: l.designation,
          reference: l.reference ?? '',
          category: l.category.value,
          unit: l.unit ?? '',
          quantity: l.quantity,
          unit_cost: l.unit_cost ?? 0,
          coefficient: l.coefficient ?? 1,
        },
      ]),
    )
  },
  { immediate: true, deep: true },
)

function save(line: QuoteLine, field: keyof Draft): void {
  const draft = drafts.value[line.id]
  if (!draft) return
  const value = draft[field]
  const current: Record<keyof Draft, unknown> = {
    designation: line.designation,
    reference: line.reference ?? '',
    category: line.category.value,
    unit: line.unit ?? '',
    quantity: line.quantity,
    unit_cost: line.unit_cost ?? 0,
    coefficient: line.coefficient ?? 1,
  }
  if (value === current[field]) return
  if (field === 'designation' && !String(value).trim()) {
    draft.designation = line.designation
    return
  }
  const payload: Partial<QuoteLinePayload> =
    field === 'reference' || field === 'unit'
      ? { [field]: String(value).trim() || null }
      : field === 'designation'
        ? { designation: String(value).trim() }
        : { [field]: value }
  emit('updateLine', line.id, payload)
}

function preview(line: QuoteLine): { unitPrice: number; total: number } {
  const d = drafts.value[line.id]
  if (!d || !props.editPrices) return { unitPrice: line.unit_price ?? 0, total: line.line_total ?? 0 }
  return linePrice(d.unit_cost, d.coefficient, d.quantity)
}

// Nouvelle ligne
const canPickArticle = useAuthStore().can('stock.view')
/** Article du stock : la ligne reprend sa désignation, sa catégorie, son coût et son coefficient. */
function addArticle(article: Article): void {
  emit('addLine', { article_id: article.id, quantity: newLine.value.quantity || 1 })
}

const newLine = ref({ designation: '', quantity: 1, unit_cost: 0, coefficient: 1, category: 'other' as QuoteLineCategory })
function add(): void {
  if (!newLine.value.designation.trim()) return
  emit('addLine', {
    designation: newLine.value.designation.trim(),
    quantity: newLine.value.quantity,
    category: newLine.value.category,
    ...(props.editPrices ? { unit_cost: newLine.value.unit_cost, coefficient: newLine.value.coefficient } : {}),
  })
  newLine.value = { ...newLine.value, designation: '', quantity: 1, unit_cost: 0 }
}

function move(index: number, direction: -1 | 1): void {
  const ids = props.section.lines.map((l) => l.id)
  const target = index + direction
  if (target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  emit('orderLines', ids)
}

// Menu d'une ligne : déplacer vers une autre section, supprimer
const menu = ref<InstanceType<typeof Menu> | null>(null)
const menuItems = ref<Array<Record<string, unknown>>>([])
function openMenu(event: Event, line: QuoteLine): void {
  const others = props.sections.filter((s) => s.id !== props.section.id)
  menuItems.value = [
    ...(line.article ? [{ label: "Voir l'article du stock", icon: 'pi pi-external-link', command: () => window.open(articleHref(line.article!.id), '_blank') }] : []),
    ...(props.canLink
      ? [
          { label: line.article ? 'Lier à un autre article…' : 'Lier à un article du stock…', icon: 'pi pi-link', command: () => (linkFor.value = line) },
          ...(line.article ? [{ label: "Délier l'article", icon: 'pi pi-times', command: () => emit('linkArticle', line.id, null) }] : []),
        ]
      : []),
    ...(props.editable && others.length
      ? [{ label: 'Déplacer vers', items: others.map((s) => ({ label: s.title, command: () => emit('updateLine', line.id, { quote_section_id: s.id }) })) }]
      : []),
    ...(props.editable ? [{ label: 'Supprimer la ligne', icon: 'pi pi-trash', command: () => emit('removeLine', line.id) }] : []),
  ]
  menu.value?.toggle(event)
}

/** Trie les lignes par catégorie ; rien n'est envoyé si l'ordre est déjà le bon. */
const alreadySorted = computed(() => {
  const ids = props.section.lines.map((l) => l.id)
  return sortedByCategory(props.section.lines).every((id, i) => id === ids[i])
})
function sortByCategory(): void {
  if (!alreadySorted.value) emit('orderLines', sortedByCategory(props.section.lines))
}

const subtotal = computed(() => props.section.lines.reduce((sum, l) => sum + preview(l).total, 0))
const money = (v: number) => formatMoney(v, props.currency)
</script>

<template>
  <Teleport to="body" :disabled="!fullscreen">
  <section class="quote-section" :class="{ hidden: !props.section.is_visible, fullscreen }">
    <header>
      <InputText
        v-model="title"
        class="title"
        :disabled="!props.editable"
        aria-label="Titre de la section"
        @change="title.trim() ? emit('updateSection', { title: title.trim() }) : (title = props.section.title)"
      />
      <label v-if="props.editable" class="visible">
        <ToggleSwitch
          :model-value="props.section.is_visible"
          @update:model-value="(v: boolean) => emit('updateSection', { is_visible: v })"
        />
        {{ props.section.is_visible ? 'Imprimée et comptée' : 'Masquée' }}
      </label>
      <span v-if="props.showPrices" class="subtotal">{{ money(subtotal) }}</span>
      <Button
        v-if="props.editable"
        :icon="formsOpen ? 'pi pi-eye' : 'pi pi-pencil'"
        :label="formsOpen ? 'Lecture' : 'Modifier les lignes'"
        :severity="formsOpen ? 'secondary' : undefined"
        text
        size="small"
        :aria-pressed="formsOpen"
        title="Afficher ou masquer les formulaires des lignes"
        @click="formsOpen = !formsOpen"
      />
      <Button
        :icon="fullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
        text
        rounded
        size="small"
        severity="secondary"
        :aria-label="fullscreen ? 'Quitter le plein écran' : 'Afficher la section en plein écran'"
        :title="fullscreen ? 'Quitter le plein écran (Échap)' : 'Plein écran'"
        @click="fullscreen = !fullscreen"
      />
      <template v-if="props.editable && showForms">
        <Button
          icon="pi pi-sort-amount-down"
          label="Trier par catégorie"
          text
          size="small"
          :disabled="props.section.lines.length < 2 || alreadySorted"
          title="Centrale, organes, câble, accessoires, main-d'œuvre, autre"
          @click="sortByCategory"
        />
        <Button v-if="props.canSaveTemplate" icon="pi pi-bookmark" text rounded size="small" title="Enregistrer comme modèle" aria-label="Enregistrer comme modèle" :disabled="!props.section.lines.length" @click="emit('saveAsTemplate')" />
        <Button icon="pi pi-arrow-up" text rounded size="small" :disabled="props.first" aria-label="Monter la section" @click="emit('moveSection', -1)" />
        <Button icon="pi pi-arrow-down" text rounded size="small" :disabled="props.last" aria-label="Descendre la section" @click="emit('moveSection', 1)" />
        <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer la section" @click="emit('removeSection')" />
      </template>
    </header>

    <div class="table-wrap">
    <table class="lines">
      <thead>
        <tr>
          <th class="thumb-col" aria-label="Article" />
          <th>Désignation</th>
          <th style="width: 9rem">Catégorie</th>
          <th style="width: 6.5rem">Quantité</th>
          <th style="width: 4.5rem">Unité</th>
          <template v-if="props.editPrices">
            <th style="width: 8.5rem">Coût unitaire</th>
            <th style="width: 6rem">Coef.</th>
          </template>
          <template v-if="props.showPrices">
            <th class="num" style="width: 8rem">Prix unitaire</th>
            <th class="num" style="width: 9rem">Montant</th>
          </template>
          <th v-if="props.editable || props.canLink" :style="{ width: showForms ? '6.5rem' : '2.5rem' }" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(line, index) in props.section.lines" :key="line.id" :class="{ zero: !line.quantity || !preview(line).unitPrice }">
          <td class="thumb-col">
            <a
              v-if="line.article"
              :href="articleHref(line.article.id)"
              target="_blank"
              rel="noopener"
              class="thumb"
              :class="{ deleted: line.article.deleted }"
              :title="`${line.article.designation}${line.article.reference ? ` — ${line.article.reference}` : ''} · voir l'article du stock`"
            >
              <img v-if="line.article.image_url" :src="line.article.image_url" :alt="line.article.designation" loading="lazy" />
              <i v-else class="pi pi-box" />
            </a>
            <button v-else-if="props.canLink" type="button" class="thumb empty-thumb" title="Lier à un article du stock" aria-label="Lier à un article du stock" @click="linkFor = line">
              <i class="pi pi-link" />
            </button>
          </td>
          <template v-if="!showForms">
            <td>
              <div class="read-designation">{{ line.designation }}</div>
              <div v-if="line.reference" class="read-ref muted">{{ line.reference }}</div>
              <div v-if="line.article" class="read-article">
                <i class="pi pi-box" /> {{ line.article.reference || line.article.designation }}
                <span v-if="line.article.deleted" class="muted">(retiré du stock)</span>
                <span v-else class="muted">· {{ line.article.quantity }} {{ line.article.unit || 'u' }} en stock</span>
              </div>
            </td>
            <td><span class="read-cat">{{ line.category.label }}</span></td>
            <td class="num">{{ line.quantity }}</td>
            <td>{{ line.unit || 'u' }}</td>
            <template v-if="props.editPrices">
              <td class="num muted">{{ money(line.unit_cost ?? 0) }}</td>
              <td class="num muted">× {{ line.coefficient }}</td>
            </template>
            <template v-if="props.showPrices">
              <td class="num">{{ money(line.unit_price ?? 0) }}</td>
              <td class="num strong">{{ money(line.line_total ?? 0) }}</td>
            </template>
            <td v-if="props.editable || props.canLink" class="actions">
              <Button icon="pi pi-ellipsis-v" text rounded size="small" aria-label="Plus d'actions" @click="openMenu($event, line)" />
            </td>
          </template>
          <template v-else-if="drafts[line.id]">
            <td>
              <InputText v-model="drafts[line.id]!.designation" class="full" :disabled="!props.editable" @change="save(line, 'designation')" />
              <Textarea
                v-model="drafts[line.id]!.reference"
                class="full ref"
                rows="1"
                auto-resize
                placeholder="Référence, marque, détail…"
                :disabled="!props.editable"
                @change="save(line, 'reference')"
              />
            </td>
            <td>
              <Select
                v-model="drafts[line.id]!.category"
                :options="categories"
                option-label="label"
                option-value="value"
                class="full"
                :disabled="!props.editable"
                @change="save(line, 'category')"
              />
            </td>
            <td>
              <InputNumber
                v-model="drafts[line.id]!.quantity"
                :min="0"
                :max-fraction-digits="2"
                class="full"
                input-class="num-input"
                :disabled="!props.editable"
                @blur="save(line, 'quantity')"
              />
            </td>
            <td>
              <InputText v-model="drafts[line.id]!.unit" class="full" placeholder="u" :disabled="!props.editable" @change="save(line, 'unit')" />
            </td>
            <template v-if="props.editPrices">
              <td>
                <InputNumber
                  v-model="drafts[line.id]!.unit_cost"
                  :min="0"
                  :max-fraction-digits="2"
                  class="full"
                  input-class="num-input"
                  :disabled="!props.editable"
                  @blur="save(line, 'unit_cost')"
                />
              </td>
              <td>
                <InputNumber
                  v-model="drafts[line.id]!.coefficient"
                  :min="0"
                  :max-fraction-digits="4"
                  class="full"
                  input-class="num-input"
                  :disabled="!props.editable"
                  @blur="save(line, 'coefficient')"
                />
              </td>
            </template>
            <template v-if="props.showPrices">
              <td class="num">{{ money(preview(line).unitPrice) }}</td>
              <td class="num strong">{{ money(preview(line).total) }}</td>
            </template>
            <td v-if="props.editable" class="actions">
              <Button icon="pi pi-angle-up" text rounded size="small" :disabled="index === 0" aria-label="Monter" @click="move(index, -1)" />
              <Button icon="pi pi-angle-down" text rounded size="small" :disabled="index === props.section.lines.length - 1" aria-label="Descendre" @click="move(index, 1)" />
              <Button icon="pi pi-ellipsis-v" text rounded size="small" aria-label="Plus d'actions" @click="openMenu($event, line)" />
            </td>
          </template>
        </tr>
        <tr v-if="!props.section.lines.length">
          <td :colspan="columns" class="muted empty">
            Aucune ligne dans cette section.
            <Button v-if="props.editable && !showForms" label="Ajouter des lignes" icon="pi pi-plus" text size="small" @click="formsOpen = true" />
          </td>
        </tr>
      </tbody>
      <tfoot v-if="showForms">
        <tr class="new-line">
          <td />
          <td>
            <InputText v-model="newLine.designation" class="full" placeholder="Nouvelle ligne : désignation, puis Entrée" @keydown.enter.prevent="add" />
          </td>
          <td>
            <Select v-model="newLine.category" :options="categories" option-label="label" option-value="value" class="full" />
          </td>
          <td><InputNumber v-model="newLine.quantity" :min="0" :max-fraction-digits="2" class="full" input-class="num-input" @keydown.enter.prevent="add" /></td>
          <td />
          <template v-if="props.editPrices">
            <td><InputNumber v-model="newLine.unit_cost" :min="0" :max-fraction-digits="2" class="full" input-class="num-input" @keydown.enter.prevent="add" /></td>
            <td><InputNumber v-model="newLine.coefficient" :min="0" :max-fraction-digits="4" class="full" input-class="num-input" @keydown.enter.prevent="add" /></td>
          </template>
          <template v-if="props.showPrices">
            <td class="num muted">{{ money(linePrice(newLine.unit_cost, newLine.coefficient, newLine.quantity).unitPrice) }}</td>
            <td />
          </template>
          <td><Button icon="pi pi-plus" size="small" aria-label="Ajouter la ligne" :disabled="!newLine.designation.trim()" @click="add" /></td>
        </tr>
        <tr v-if="canPickArticle" class="new-line">
          <td />
          <td :colspan="columns - 1">
            <ArticlePicker placeholder="… ou choisir un article du stock (quantité ci-dessus)" @select="addArticle" />
          </td>
        </tr>
      </tfoot>
    </table>
    </div>
    <div class="proposal">
      <button v-if="!proposalOpen" type="button" class="link small" @click="proposalOpen = true">
        <i class="pi pi-align-left" /> {{ props.canEditProposal ? 'Ajouter la proposition technique de cette section' : '' }}
      </button>
      <template v-else>
        <label class="muted small" :for="`proposal-${props.section.id}`">Proposition technique</label>
        <MarkdownEditor
          :id="`proposal-${props.section.id}`"
          v-model="proposal"
          rows="2"
          auto-resize
          class="full"
          placeholder="Décrivez la solution : matériel, fonctionnement, garanties… (imprimé dans la proposition technique)"
          :disabled="!props.canEditProposal"
          @change="saveProposal"
        />
      </template>
    </div>
    <p v-if="props.editable && !props.editPrices" class="muted hint">
      Vous rédigez les lignes ; le chiffrage (coût et coefficient) revient à un commercial ou au manager.
    </p>
    <Menu ref="menu" :model="menuItems" popup />
    <Dialog :visible="!!linkFor" header="Lier à un article du stock" modal :style="{ width: '520px' }" @update:visible="(v) => !v && (linkFor = null)">
      <p class="muted small">
        Ligne « {{ linkFor?.designation }} » : la ligne garde sa désignation et ses prix ; l'article sert à consulter sa fiche et sa photo.
      </p>
      <ArticlePicker placeholder="Rechercher un article (désignation, référence)…" @select="pickLinked" />
    </Dialog>
  </section>
  </Teleport>
</template>

<style scoped>
.quote-section {
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 0.75rem;
  background: var(--p-content-background);
  min-width: 0;
}

/* Plein écran : la section occupe toute la fenêtre (les fenêtres PrimeVue, à partir de 1100, restent au-dessus) */
.quote-section.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  border-radius: 0;
  border: none;
  padding: 1rem 1.5rem;
  overflow: auto;
  opacity: 1;
}

/* Le tableau défile dans la carte au lieu d'en déborder */
.table-wrap {
  overflow-x: auto;
  max-width: 100%;
}

.quote-section.hidden {
  opacity: 0.6;
  border-style: dashed;
}

header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.fullscreen header {
  position: sticky;
  top: -1rem;
  z-index: 2;
  background: var(--p-content-background);
  padding: 0.5rem 0;
}

.title {
  flex: 1 1 14rem;
  min-width: 10rem;
  font-weight: 600;
}

.visible {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.subtotal {
  font-weight: 600;
  white-space: nowrap;
}

.lines {
  width: 100%;
  min-width: 44rem;
  border-collapse: collapse;
}

.lines th:nth-child(2) {
  min-width: 14rem;
}

.lines th {
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  padding: 0.25rem;
}

.lines td {
  padding: 0.25rem;
  vertical-align: top;
}

.lines tbody tr + tr td {
  border-top: 1px solid var(--p-content-border-color);
}

.num {
  text-align: right;
  white-space: nowrap;
  padding-top: 0.6rem !important;
}

.strong {
  font-weight: 600;
}

.full {
  width: 100%;
}

.thumb-col {
  width: 3.25rem;
}
.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  background: #fff;
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
.empty-thumb {
  border-style: dashed;
  background: none;
  cursor: pointer;
  opacity: 0.5;
}
.empty-thumb:hover {
  opacity: 1;
  color: var(--p-primary-color);
  border-color: var(--p-primary-color);
}
.read-designation {
  font-weight: 600;
  padding-top: 0.35rem;
}
.read-ref {
  font-size: 0.8rem;
  white-space: pre-line;
}
.read-article {
  font-size: 0.75rem;
  color: var(--p-primary-color);
  margin-top: 0.125rem;
}
.read-cat {
  display: inline-block;
  padding-top: 0.35rem;
  font-size: 0.85rem;
}
.small {
  font-size: 0.85rem;
}

.ref {
  margin-top: 0.25rem;
  font-size: 0.8rem;
}

.zero td {
  color: var(--p-text-muted-color);
}

.actions {
  white-space: nowrap;
}

.new-line td {
  padding-top: 0.5rem;
  border-top: 2px solid var(--p-content-border-color);
}

.empty {
  padding: 0.75rem 0.25rem;
}

.proposal {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
}

.proposal :deep(textarea) {
  width: 100%;
}

.hint {
  font-size: 0.8rem;
  margin: 0.5rem 0 0;
}

:deep(.num-input) {
  text-align: right;
  width: 100%;
}
</style>
