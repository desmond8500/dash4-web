<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { ApiError, loanDueText, toolSeverity } from '@dash4/shared'
import type { Tool, ToolLoan, ToolOptions, ToolStatus } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/projects'
import { searchOnly } from '@/utils/listSearch'
import ToolFormDialog from '@/components/tools/ToolFormDialog.vue'
import ToolLendDialog from '@/components/tools/ToolLendDialog.vue'
import ToolReturnDialog from '@/components/tools/ToolReturnDialog.vue'

/** Outillage : les outils (liés aux articles du stock), qui les a, et les prêts à rendre ou en retard. */
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

type View = 'tools' | 'loans'
type Filter = 'all' | ToolStatus
const view = ref<View>(route.query.vue === 'prets' ? 'loans' : 'tools')
const filter = ref<Filter>('all')
const search = ref('')
const tools = ref<Tool[]>([])
const loans = ref<ToolLoan[]>([])
const options = ref<ToolOptions | null>(null)
const loading = ref(false)
const createOpen = ref(false)
const lendFor = ref<Tool | null>(null)
const returnFor = ref<{ tool: Pick<Tool, 'id' | 'title' | 'condition'>; loan: ToolLoan } | null>(null)
const lendOpen = computed({ get: () => !!lendFor.value, set: (v) => !v && (lendFor.value = null) })
const returnOpen = computed({ get: () => !!returnFor.value, set: (v) => !v && (returnFor.value = null) })
const canLend = computed(() => auth.can('tools.lend'))

watch(view, (v) => void router.replace({ query: { ...route.query, vue: v === 'loans' ? 'prets' : undefined } }))

async function load(): Promise<void> {
  loading.value = true
  try {
    ;[tools.value, loans.value] = await Promise.all([api.tools.list(), api.tools.loans({ open: true })])
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: e instanceof ApiError ? e.message : undefined, life: 5000 })
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  void load()
  options.value = await api.tools.options().catch(() => null)
})

const counts = computed(() => ({
  available: tools.value.filter((t) => t.status.value === 'available').length,
  lent: tools.value.filter((t) => t.status.value === 'lent' || t.status.value === 'late').length,
  late: tools.value.filter((t) => t.status.value === 'late').length,
  unavailable: tools.value.filter((t) => t.status.value === 'unavailable').length,
}))
const filters = computed(() => [
  { v: 'all', l: `Tous (${tools.value.length})` },
  { v: 'available', l: `Disponibles (${counts.value.available})` },
  { v: 'lent', l: `Prêtés (${counts.value.lent})` },
  ...(counts.value.late ? [{ v: 'late', l: `En retard (${counts.value.late})` }] : []),
  ...(counts.value.unavailable ? [{ v: 'unavailable', l: `Indisponibles (${counts.value.unavailable})` }] : []),
])
const shownTools = computed(() =>
  searchOnly(
    tools.value.filter((t) => filter.value === 'all' || t.status.value === filter.value || (filter.value === 'lent' && t.status.value === 'late')),
    search.value,
    (t) => [t.name, t.code, t.serial_number, t.article?.designation, t.article?.reference, t.current_loan?.borrower_label, t.storage_location?.name],
  ),
)
const shownLoans = computed(() =>
  searchOnly(loans.value, search.value, (l) => [l.tool?.title, l.borrower_label, l.project?.name]),
)

function updated(tool: Tool): void {
  tools.value = tools.value.map((t) => (t.id === tool.id ? tool : t))
  void api.tools.loans({ open: true }).then((l) => (loans.value = l))
}
async function remind(toolId: number, loan: ToolLoan): Promise<void> {
  try {
    updated(await api.tools.remind(toolId, loan.id))
    toast.add({ severity: 'success', summary: 'Rappel envoyé', detail: loan.borrower_label, life: 2500 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Rappel impossible', detail: e instanceof ApiError ? e.message : undefined, life: 6000 })
  }
}
function openReturn(loan: ToolLoan): void {
  const tool = tools.value.find((t) => t.id === loan.tool_id)
  if (tool) returnFor.value = { tool, loan }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text rounded aria-label="Retour au stock" @click="router.push({ name: 'stock' })" />
      <h1 class="grow">Outillage</h1>
      <Button v-if="auth.can('tools.create')" label="Nouvel outil" icon="pi pi-plus" @click="createOpen = true" />
    </div>
    <div class="filters">
      <SelectButton
        v-model="view"
        :options="[{ v: 'tools', l: 'Outils' }, { v: 'loans', l: `Prêts en cours (${loans.length})` }]"
        option-label="l"
        option-value="v"
        :allow-empty="false"
        aria-label="Affichage"
      />
      <SelectButton v-if="view === 'tools'" v-model="filter" :options="filters" option-label="l" option-value="v" :allow-empty="false" aria-label="Disponibilité" />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Outil, n°, article, emprunteur…" aria-label="Rechercher un outil" />
      </IconField>
    </div>

    <DataTable
      v-if="view === 'tools'"
      :value="shownTools"
      :loading="loading"
      data-key="id"
      row-hover
      class="clickable"
      @row-click="(e) => router.push({ name: 'tool', params: { id: e.data.id } })"
    >
      <template #empty>{{ search || filter !== 'all' ? 'Aucun outil ne correspond.' : 'Aucun outil enregistré : créez-les à partir des articles du stock.' }}</template>
      <Column header="Outil">
        <template #body="{ data }">
          <strong>{{ data.name }}</strong>
          <div class="muted small">{{ [data.code, data.article?.reference, data.serial_number ? `S/N ${data.serial_number}` : null].filter(Boolean).join(' · ') }}</div>
        </template>
      </Column>
      <Column header="Rangé à" style="width: 10rem"><template #body="{ data }">{{ data.storage_location?.name ?? '—' }}</template></Column>
      <Column header="État" style="width: 9rem"><template #body="{ data }"><span :class="{ muted: data.condition.value === 'good' }">{{ data.condition.label }}</span></template></Column>
      <Column header="Disponibilité" style="width: 11rem">
        <template #body="{ data }"><Tag :value="data.status.label" :severity="toolSeverity(data.status.value)" /></template>
      </Column>
      <Column header="Chez">
        <template #body="{ data }">
          <template v-if="data.current_loan">
            <strong>{{ data.current_loan.borrower_label }}</strong>
            <div class="small" :class="data.current_loan.state === 'late' ? 'late' : 'muted'">{{ loanDueText(data.current_loan) }}</div>
          </template>
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column v-if="canLend" header="" style="width: 9rem">
        <template #body="{ data }">
          <Button v-if="data.current_loan" label="Retour" icon="pi pi-sign-in" size="small" text @click.stop="returnFor = { tool: data, loan: data.current_loan }" />
          <Button v-else-if="data.status.value === 'available'" label="Prêter" icon="pi pi-sign-out" size="small" text @click.stop="lendFor = data" />
        </template>
      </Column>
    </DataTable>

    <DataTable v-else :value="shownLoans" :loading="loading" data-key="id" row-hover class="clickable" @row-click="(e) => router.push({ name: 'tool', params: { id: e.data.tool_id } })">
      <template #empty>Aucun outil prêté en ce moment.</template>
      <Column header="Outil"><template #body="{ data }"><strong>{{ data.tool?.title }}</strong></template></Column>
      <Column header="Chez">
        <template #body="{ data }">
          {{ data.borrower_label }}
          <div v-if="data.borrower_phone" class="muted small">{{ data.borrower_phone }}</div>
        </template>
      </Column>
      <Column header="Projet"><template #body="{ data }">{{ data.project?.name ?? '—' }}</template></Column>
      <Column header="Depuis le" style="width: 8rem"><template #body="{ data }">{{ formatDate(data.lent_at) }}</template></Column>
      <Column header="Retour" style="width: 12rem">
        <template #body="{ data }"><Tag :value="loanDueText(data)" :severity="toolSeverity(data.state)" /></template>
      </Column>
      <Column v-if="canLend" header="" style="width: 12rem">
        <template #body="{ data }">
          <Button v-if="data.borrower_id" icon="pi pi-bell" text rounded aria-label="Envoyer un rappel" title="Envoyer un rappel" @click.stop="remind(data.tool_id, data)" />
          <Button label="Retour" icon="pi pi-sign-in" size="small" text @click.stop="openReturn(data)" />
        </template>
      </Column>
    </DataTable>

    <ToolFormDialog v-model:visible="createOpen" :tool="null" :options="options" @saved="(list) => (list.length === 1 ? router.push({ name: 'tool', params: { id: list[0]!.id } }) : load())" />
    <ToolLendDialog v-model:visible="lendOpen" :tool="lendFor" :options="options" @saved="updated" />
    <ToolReturnDialog v-model:visible="returnOpen" :tool="returnFor?.tool ?? null" :loan="returnFor?.loan ?? null" :options="options" @saved="updated" />
  </div>
</template>

<style scoped>
.grow {
  flex: 1;
}
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 0.75rem;
}
.small {
  font-size: 0.85rem;
}
.late {
  color: var(--p-red-500);
  font-weight: 600;
}
:deep(.clickable tbody tr) {
  cursor: pointer;
}
</style>
