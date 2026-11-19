<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import AutoComplete from 'primevue/autocomplete'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, quantityTotals } from '@dash4/shared'
import type { Article, Quantity, QuantityRow, Site } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/** Quantitatifs du chantier : lignes par pièce, totaux par article, transformation en devis brouillon. */
const props = defineProps<{ site: Site }>()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

type Row = Omit<QuantityRow, 'id' | 'position'> & { articleRef: Article | { id: number; designation: string; reference: string | null } | null }
const list = ref<Quantity[]>([])
const open = ref(false)
const current = ref<Quantity | null>(null)
const form = ref({ name: '', description: '', building_id: null as number | null, installed_system_id: null as number | null, rows: [] as Row[] })
const suggestions = ref<Article[]>([])
const error = ref<string | null>(null)
const saving = ref(false)
const converting = ref<number | null>(null)

const rooms = computed(() => props.site.buildings.flatMap((b) => b.levels.flatMap((l) => l.rooms.map((r) => ({ id: r.id, label: `${b.name} › ${l.name} › ${r.name}` })))))
const roomName = (id: number | null) => rooms.value.find((r) => r.id === id)?.label ?? ''
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  list.value = await api.quantities.list(props.site.project.id).catch(() => [])
}
watch(() => props.site.project.id, load, { immediate: true })

const blankRow = (): Row => ({ article_id: null, articleRef: null, designation: '', unit: null, quantity: 1, level_id: null, room_id: null, description: null })
function edit(q: Quantity | null): void {
  current.value = q
  error.value = null
  form.value = {
    name: q?.name ?? '',
    description: q?.description ?? '',
    building_id: q?.building_id ?? null,
    installed_system_id: q?.installed_system_id ?? null,
    rows: q?.rows?.map((r) => ({ ...r, articleRef: r.article ?? null })) ?? [blankRow()],
  }
  open.value = true
}

async function search(e: { query: string }): Promise<void> {
  suggestions.value = (await api.articles.list({ search: e.query, per_page: 15 }).catch(() => ({ data: [] as Article[] }))).data
}
function pickArticle(row: Row, a: Article | null): void {
  row.article_id = a?.id ?? null
  if (a) {
    row.designation = a.designation
    row.unit = a.unit ?? null
  }
}

async function save(): Promise<void> {
  const f = form.value
  if (!f.name.trim()) return void (error.value = 'Donnez un nom au quantitatif.')
  const rows = f.rows.filter((r) => r.article_id || r.designation.trim()).map((r) => ({
    article_id: r.article_id, designation: r.designation.trim(), unit: r.unit, quantity: r.quantity || 0, level_id: r.level_id, room_id: r.room_id, description: r.description,
  }))
  saving.value = true
  try {
    const payload = { name: f.name.trim(), description: f.description.trim() || null, building_id: f.building_id, installed_system_id: f.installed_system_id, rows }
    const saved = current.value ? await api.quantities.update(current.value.id, payload) : await api.quantities.create(props.site.project.id, payload)
    current.value = saved
    open.value = false
    await load()
  } catch (e) {
    error.value = errorDetail(e)
  } finally {
    saving.value = false
  }
}

async function toQuote(q: Quantity): Promise<void> {
  converting.value = q.id
  try {
    const quote = await api.quantities.toQuote(q.id)
    toast.add({ severity: 'success', summary: 'Devis créé', detail: quote.number ?? quote.title, life: 3000 })
    void router.push({ name: 'quote', params: { id: quote.id } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Devis impossible', detail: errorDetail(e), life: 6000 })
  } finally {
    converting.value = null
  }
}
function remove(q: Quantity): void {
  confirm.require({
    header: 'Supprimer le quantitatif',
    message: `Supprimer « ${q.name} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.quantities.remove(q.id)
      await load()
    },
  })
}
</script>

<template>
  <div class="quantities">
    <div class="head">
      <span class="grow muted">Comptez le matériel pièce par pièce, puis faites-en un devis : une ligne par article, prix repris du stock.</span>
      <Button v-if="props.site.can.create" label="Nouveau quantitatif" icon="pi pi-plus" size="small" @click="edit(null)" />
    </div>
    <p v-if="!list.length" class="muted">Aucun quantitatif.</p>
    <div v-for="q in list" :key="q.id" class="card">
      <div class="row">
        <button type="button" class="link grow" @click="edit(q)"><strong>{{ q.name }}</strong></button>
        <router-link v-if="q.quote" :to="{ name: 'quote', params: { id: q.quote.id } }" class="small">Devis {{ q.quote.number ?? q.quote.title }}</router-link>
        <Button v-if="auth.can('quotes.create')" label="Créer le devis" icon="pi pi-file" size="small" text :loading="converting === q.id" @click="toQuote(q)" />
        <Button v-if="props.site.can.delete" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="remove(q)" />
      </div>
      <p class="small muted totals">
        <template v-for="(t, i) in quantityTotals(q.rows ?? [])" :key="i">{{ i ? ' · ' : '' }}{{ t.quantity }}{{ t.unit ? ` ${t.unit}` : ' ×' }} {{ t.designation }}</template>
      </p>
    </div>

    <Dialog v-model:visible="open" :header="current ? current.name : 'Nouveau quantitatif'" modal :style="{ width: '900px' }" :breakpoints="{ '940px': '96vw' }">
      <form id="qty-form" class="form-grid" @submit.prevent="save">
        <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
        <div class="form-field"><label for="q-name">Nom</label><InputText id="q-name" v-model="form.name" placeholder="Détection incendie bâtiment A" /></div>
        <div v-if="props.site.systems.length" class="form-field">
          <label for="q-sys">Système</label>
          <Select id="q-sys" v-model="form.installed_system_id" :options="[{ id: null, name: '—' }, ...props.site.systems]" option-label="name" option-value="id" />
        </div>
        <div class="form-field form-field--full">
          <table class="list rows">
            <thead><tr><th>Article / désignation</th><th style="width:110px">Quantité</th><th style="width:80px">Unité</th><th style="width:240px">Pièce</th><th /></tr></thead>
            <tbody>
              <tr v-for="(r, i) in form.rows" :key="i">
                <td>
                  <AutoComplete v-if="auth.can('stock.view')" v-model="r.articleRef" :suggestions="suggestions" option-label="designation" placeholder="Article du stock" fluid @complete="search" @option-select="(e) => pickArticle(r, e.value)" @clear="pickArticle(r, null)" />
                  <InputText v-model="r.designation" placeholder="Désignation" fluid class="designation" />
                </td>
                <td><InputNumber v-model="r.quantity" :min="0" :max-fraction-digits="2" fluid /></td>
                <td><InputText v-model="r.unit" placeholder="u, m…" fluid /></td>
                <td><Select v-model="r.room_id" :options="[{ id: null, label: '—' }, ...rooms]" option-label="label" option-value="id" filter fluid /></td>
                <td><Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="form.rows.splice(i, 1)" /></td>
              </tr>
            </tbody>
          </table>
          <Button label="Ajouter une ligne" icon="pi pi-plus" text size="small" @click="form.rows.push(blankRow())" />
        </div>
        <p v-if="form.rows.some((r) => r.room_id)" class="form-field--full small muted">
          Total : <template v-for="(t, i) in quantityTotals(form.rows)" :key="i">{{ i ? ' · ' : '' }}{{ t.quantity }} {{ t.designation || '—' }}</template>
        </p>
      </form>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="open = false" />
        <Button v-if="!current || props.site.can.manage" label="Enregistrer" icon="pi pi-check" type="submit" form="qty-form" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.quantities {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.head,
.row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card {
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.totals {
  margin: 0.25rem 0 0;
}

.rows td {
  vertical-align: top;
}

.designation {
  margin-top: 0.25rem;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.85rem;
}

.link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--p-primary-color);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
</style>
