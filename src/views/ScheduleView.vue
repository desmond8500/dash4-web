<script setup lang="ts">
import { searchOnly } from '@/utils/listSearch'
import ListSearch from '@/components/ListSearch.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { formatMoney, type ScheduleItem } from '@dash4/shared'
import { api } from '@/services/api'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/projects'
import { groupByMonth } from '@/utils/schedule'

const router = useRouter()
const settings = useSettingsStore()
const items = ref<ScheduleItem[]>([])
const meta = ref({ total: 0, overdue: 0 })
const months = ref(6)
const loading = ref(true)
const query = ref('')
const groups = computed(() => groupByMonth(searchOnly(items.value, query.value, (i) => [i.label, i.client, kinds[i.kind]])))
const money = (v: number) => formatMoney(v, settings.currency())
const kinds = { invoice: 'Facture', deposit: 'Acompte', contract: 'Contrat' } as const

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await api.invoices.schedule(months.value)
    items.value = res.data
    meta.value = res.meta
  } finally {
    loading.value = false
  }
}
onMounted(load)

function open(i: ScheduleItem): void {
  void router.push({ name: { invoice: 'invoice', deposit: 'quote', contract: 'contract' }[i.kind], params: { id: i.id } })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Échéancier</h1>
        <p class="muted">Ce qui doit être encaissé : factures non soldées, acomptes prévus des devis acceptés, prochaines périodes des contrats.</p>
      </div>
      <Select v-model="months" :options="[3, 6, 12]" :option-label="(m: number) => `${m} mois`" @change="load" />
    </div>

    <div class="kpis">
      <Card><template #content><div class="muted small">À encaisser</div><div class="kpi">{{ money(meta.total) }}</div></template></Card>
      <Card><template #content><div class="muted small">Dont en retard</div><div class="kpi late">{{ money(meta.overdue) }}</div></template></Card>
    </div>

    <ListSearch v-if="items.length > 5" v-model="query" class="search" placeholder="Client, facture, devis, contrat…" />
    <p v-if="!loading && !items.length" class="muted">Rien à encaisser sur la période.</p>
    <p v-else-if="query.trim() && !groups.length" class="muted">Rien ne correspond à la recherche.</p>
    <Card v-for="g in groups" :key="g.key">
      <template #title>
        <div class="month"><span :class="{ late: g.key === '0000-00' }">{{ g.label }}</span><span>{{ money(g.total) }}</span></div>
      </template>
      <template #content>
        <table class="list">
          <tbody>
            <tr v-for="(i, n) in g.items" :key="`${i.kind}-${i.id}-${n}`" class="row" @click="open(i)">
              <td style="width: 7rem">{{ formatDate(i.date) }}</td>
              <td style="width: 6rem"><Tag :value="kinds[i.kind]" :severity="i.kind === 'invoice' ? (i.overdue ? 'danger' : 'info') : 'secondary'" /></td>
              <td>{{ i.label }}<div v-if="i.client" class="muted small">{{ i.client }}</div></td>
              <td class="num">{{ money(i.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.search {
  margin-bottom: 1rem;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}
.kpi {
  font-size: 1.5rem;
  font-weight: 600;
}
.late {
  color: var(--p-red-500);
}
.month {
  display: flex;
  justify-content: space-between;
}
.list {
  width: 100%;
  border-collapse: collapse;
}
.list td {
  padding: 0.5rem 0.25rem;
  border-bottom: 1px solid var(--p-content-border-color);
}
.row {
  cursor: pointer;
}
.row:hover {
  background: var(--p-content-hover-background);
}
.num {
  text-align: right;
  white-space: nowrap;
}
.small {
  font-size: 0.85rem;
}
</style>
