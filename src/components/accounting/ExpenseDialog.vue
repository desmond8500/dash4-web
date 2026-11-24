<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import ArticleOption from '@/components/stock/ArticleOption.vue'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { ApiError, formatMoney, PAYMENT_METHODS } from '@dash4/shared'
import type { Article, Expense, ExpenseCategory, ExpensePayload, ExpenseSpace, PaymentMethod, Project } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import { expenseStatusSeverity } from '@/utils/accounting'

/**
 * Nouvelle dépense, ou fiche d'une dépense : modifiable tant qu'elle est à valider (ou par le comptable),
 * avec les boutons Valider / Refuser / Rembourser pour qui décide.
 */
const props = defineProps<{ expense?: Expense | null; spaceId?: number | null; projectId?: number | null; vehicleId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [expense: Expense]; removed: [id: number] }>()
const auth = useAuthStore()

const categories = ref<ExpenseCategory[]>([])
const spaces = ref<ExpenseSpace[]>([])
const projects = ref<Project[]>([])
const vehicles = ref<Array<{ id: number; name: string }>>([])
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)
const rejecting = ref(false)
const reason = ref('')

const form = ref({
  label: '',
  amount: null as number | null,
  date: new Date() as Date | null,
  expense_category_id: null as number | null,
  expense_space_id: null as number | null,
  project_id: null as number | null,
  vehicle_id: null as number | null,
  payment_method: 'cash' as PaymentMethod | null,
  advanced: false,
  description: '',
})
// Article du stock acheté (facultatif) : choisi par recherche
type ArticleRef = Pick<Article, 'id' | 'designation' | 'reference'>
const article = ref<ArticleRef | null>(null)
const articleSuggestions = ref<ArticleRef[]>([])
async function searchArticles(e: AutoCompleteCompleteEvent): Promise<void> {
  articleSuggestions.value = (await api.articles.list({ search: e.query, per_page: 15 }).catch(() => ({ data: [] as Article[] }))).data
}
function onArticle(a: ArticleRef | null): void {
  article.value = a
  if (a && !form.value.label.trim()) form.value.label = a.designation
}

const current = computed(() => props.expense ?? null)
const editable = computed(() => !current.value || current.value.can.update)
const willBeApproved = computed(() => !current.value && auth.can('accounting.create'))

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  file.value = null
  rejecting.value = false
  reason.value = ''
  const e = current.value
  form.value = {
    label: e?.label ?? '',
    amount: e?.amount ?? null,
    date: e ? fromApiDate(e.spent_at) : new Date(),
    expense_category_id: e?.expense_category_id ?? null,
    expense_space_id: e?.expense_space_id ?? props.spaceId ?? null,
    project_id: e?.project_id ?? props.projectId ?? null,
    vehicle_id: e?.vehicle_id ?? props.vehicleId ?? null,
    payment_method: e?.payment_method?.value ?? 'cash',
    advanced: e?.advanced ?? false,
    description: e?.description ?? '',
  }
  article.value = e?.article ?? null
  const [c, s, p, v] = await Promise.allSettled([
    api.expenseCategories.list(),
    api.expenseSpaces.list(),
    auth.canAny(['projects.view', 'projects.view.own']) ? api.projects.list({ per_page: 100 }) : Promise.reject(new Error()),
    auth.canAny(['vehicles.view', 'vehicles.view.own']) ? api.vehicles.list() : Promise.reject(new Error()),
  ])
  vehicles.value = v.status === 'fulfilled' ? v.value.map((x) => ({ id: x.id, name: x.plate ? `${x.name} (${x.plate})` : x.name })) : []
  categories.value = c.status === 'fulfilled' ? c.value : []
  spaces.value = s.status === 'fulfilled' ? s.value : []
  projects.value = p.status === 'fulfilled' ? p.value.data : []
})

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  input.value = ''
}

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function run(action: () => Promise<Expense>): Promise<void> {
  saving.value = true
  error.value = null
  try {
    const saved = await action()
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    error.value = errorDetail(e)
  } finally {
    saving.value = false
  }
}

function save(): void {
  const f = form.value
  if (!f.label.trim() || !f.amount || !f.date) {
    error.value = 'Indiquez le libellé, le montant et la date.'
    return
  }
  const payload: ExpensePayload = {
    label: f.label.trim(),
    amount: f.amount,
    spent_at: toApiDate(f.date) ?? undefined,
    expense_category_id: f.expense_category_id,
    expense_space_id: f.expense_space_id,
    project_id: f.project_id,
    vehicle_id: f.vehicle_id,
    payment_method: f.payment_method,
    advanced: f.advanced,
    description: f.description.trim() || null,
    article_id: article.value?.id ?? null,
  }
  const e = current.value
  void run(async () => {
    if (!e) return api.expenses.create({ ...payload, label: payload.label!, amount: payload.amount!, spent_at: payload.spent_at!, client_uuid: crypto.randomUUID() }, file.value ?? undefined, file.value?.name)
    const updated = await api.expenses.update(e.id, payload)
    return file.value ? api.expenses.uploadReceipt(e.id, file.value, file.value.name) : updated
  })
}

const approve = () => current.value && run(() => api.expenses.approve(current.value!.id))
const reimburse = () => current.value && run(() => api.expenses.reimburse(current.value!.id))
function reject(): void {
  if (!reason.value.trim()) {
    error.value = 'Indiquez pourquoi la dépense est refusée.'
    return
  }
  void run(() => api.expenses.reject(current.value!.id, reason.value.trim()))
}
async function remove(): Promise<void> {
  const e = current.value
  if (!e) return
  try {
    await api.expenses.remove(e.id)
    emit('removed', e.id)
    visible.value = false
  } catch (err) {
    error.value = errorDetail(err)
  }
}
async function openReceipt(): Promise<void> {
  const doc = current.value?.document
  if (!doc) return
  const url = URL.createObjectURL(await api.documents.download(doc))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="current ? current.label : 'Nouvelle dépense'" modal :style="{ width: '620px' }" :breakpoints="{ '660px': '95vw' }">
    <div v-if="current" class="status">
      <Tag :value="current.status.label" :severity="expenseStatusSeverity(current.status.value)" />
      <span class="muted small">
        Saisie par {{ current.creator?.full_name ?? '—' }}
        <template v-if="current.decider"> · {{ current.status.value === 'rejected' ? 'refusée' : 'validée' }} par {{ current.decider.full_name }}</template>
        <template v-if="current.reimbursed_at"> · remboursée le {{ formatDate(current.reimbursed_at.slice(0, 10)) }}</template>
      </span>
      <Message v-if="current.rejection_reason" severity="error" :closable="false">Motif du refus : {{ current.rejection_reason }}</Message>
    </div>

    <form id="expense-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field form-field--full">
        <label for="x-label">Libellé</label>
        <InputText id="x-label" v-model="form.label" :disabled="!editable" placeholder="Ex. : taxi chantier, carburant, câble" autofocus />
      </div>
      <div class="form-field">
        <label for="x-amount">Montant</label>
        <InputNumber v-model="form.amount" input-id="x-amount" :min="1" suffix=" F CFA" :disabled="!editable" />
      </div>
      <div class="form-field">
        <label for="x-date">Date</label>
        <DatePicker v-model="form.date" input-id="x-date" date-format="dd/mm/yy" :max-date="new Date()" :disabled="!editable" />
      </div>
      <div class="form-field">
        <label for="x-category">Catégorie</label>
        <Select id="x-category" v-model="form.expense_category_id" :options="[{ id: null, name: 'Sans catégorie' }, ...categories]" option-label="name" option-value="id" :disabled="!editable" />
      </div>
      <div class="form-field">
        <label for="x-method">Payé par</label>
        <Select id="x-method" v-model="form.payment_method" :options="PAYMENT_METHODS" option-label="label" option-value="value" :disabled="!editable" />
      </div>
      <div v-if="spaces.length" class="form-field">
        <label for="x-space">Caisse</label>
        <Select id="x-space" v-model="form.expense_space_id" :options="[{ id: null, name: 'Aucune' }, ...spaces]" option-label="name" option-value="id" :disabled="!editable" />
      </div>
      <div v-if="projects.length" class="form-field">
        <label for="x-project">Projet</label>
        <Select id="x-project" v-model="form.project_id" :options="[{ id: null, name: 'Aucun' }, ...projects]" option-label="name" option-value="id" filter :disabled="!editable" />
      </div>
      <div v-if="vehicles.length" class="form-field">
        <label for="x-vehicle">Véhicule</label>
        <Select id="x-vehicle" v-model="form.vehicle_id" :options="[{ id: null, name: 'Aucun' }, ...vehicles]" option-label="name" option-value="id" filter :disabled="!editable" />
      </div>
      <div v-if="auth.can('stock.view')" class="form-field form-field--full">
        <label for="x-article">Article du stock (facultatif)</label>
        <AutoComplete v-model="article" input-id="x-article" :suggestions="articleSuggestions" option-label="designation" force-selection placeholder="Rechercher un article" :disabled="!editable" @complete="searchArticles" @option-select="(e) => onArticle(e.value)" @clear="onArticle(null)">
          <template #option="{ option }"><ArticleOption :article="option" /></template>
        </AutoComplete>
      </div>
      <label class="form-field--full check">
        <Checkbox v-model="form.advanced" binary :disabled="!editable" />
        Payée avec mon argent : à me rembourser<span v-if="form.expense_space_id" class="muted"> (ne sort pas de la caisse)</span>
      </label>
      <div class="form-field form-field--full">
        <label for="x-desc">Détails</label>
        <MarkdownEditor id="x-desc" v-model="form.description" rows="2" auto-resize :disabled="!editable" />
      </div>
      <div class="form-field form-field--full">
        <label>Justificatif</label>
        <div class="receipt">
          <Button v-if="current?.document" :label="current.document.name" icon="pi pi-paperclip" text size="small" @click="openReceipt" />
          <span v-if="file" class="muted small">{{ file.name }}</span>
          <Button v-if="editable" :label="current?.document || file ? 'Remplacer' : 'Ajouter une photo ou un PDF'" icon="pi pi-upload" text size="small" @click="fileInput?.click()" />
          <input ref="fileInput" type="file" accept="image/*,application/pdf" hidden @change="onFile" />
        </div>
      </div>
      <p v-if="willBeApproved" class="form-field--full muted small">Saisie par le comptable : la dépense est validée tout de suite.</p>
      <p v-else-if="!current" class="form-field--full muted small">La dépense sera validée par le comptable.</p>
    </form>

    <div v-if="current?.can.decide && rejecting" class="reject">
      <InputText v-model="reason" placeholder="Motif du refus" class="grow" autofocus />
      <Button label="Refuser" severity="danger" :loading="saving" @click="reject" />
      <Button label="Annuler" text severity="secondary" @click="rejecting = false" />
    </div>

    <template #footer>
      <Button v-if="current?.can.delete" label="Supprimer" icon="pi pi-trash" severity="danger" text class="left" @click="remove" />
      <template v-if="current?.can.decide && !rejecting">
        <Button v-if="['submitted', 'approved'].includes(current.status.value)" label="Refuser" severity="danger" outlined @click="rejecting = true" />
        <Button v-if="['submitted', 'rejected'].includes(current.status.value)" label="Valider" icon="pi pi-check" severity="success" :loading="saving" @click="approve" />
        <Button v-if="current.to_reimburse" :label="`Rembourser ${formatMoney(current.amount)}`" icon="pi pi-money-bill" :loading="saving" @click="reimburse" />
      </template>
      <Button v-if="editable" :label="current ? 'Enregistrer' : 'Enregistrer la dépense'" icon="pi pi-check" type="submit" form="expense-form" :loading="saving" />
      <Button v-else label="Fermer" severity="secondary" text @click="visible = false" />
    </template>
  </Dialog>
</template>

<style scoped>
.status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.receipt {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.reject {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.grow {
  flex: 1;
}

.left {
  margin-right: auto;
}

.small {
  font-size: 0.85rem;
}
</style>
