<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import { DASHBOARD_WIDGETS, formatMoney } from '@dash4/shared'
import type { DashboardData, DashboardLayout, DashboardWidgetKey } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { useSettingsStore } from '@/stores/settings'
import { formatDate } from '@/utils/projects'
import { barHeights, monthLabel, moveWidget, toggleWidget, trend } from '@/utils/dashboard'

/** Tableau de bord : widgets selon les droits du compte, dans l'ordre choisi par l'utilisateur. */
const auth = useAuthStore()
const requests = useClientRequestsStore()
const settings = useSettingsStore()
const router = useRouter()

const data = ref<DashboardData | null>(null)
const loading = ref(true)
const customizing = ref(false)
const draft = ref<DashboardLayout>({ order: [], hidden: [] })
const money = (v: number) => formatMoney(v, settings.currency())
const visible = computed(() => (data.value?.layout.order ?? []).filter((k) => data.value?.widgets[k] !== undefined))
const w = computed(() => data.value?.widgets ?? {})

async function load(): Promise<void> {
  loading.value = true
  try {
    data.value = await api.dashboard.get()
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  void settings.load()
  void load()
})

function customize(): void {
  if (!data.value) return
  draft.value = { order: [...data.value.layout.order], hidden: [...data.value.layout.hidden] }
  customizing.value = true
}
async function saveLayout(): Promise<void> {
  data.value = await api.dashboard.saveLayout(draft.value)
  customizing.value = false
}
const go = (name: string, query: Record<string, string> = {}) => router.push({ name, query })
const greeting = computed(() => (new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'))
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>{{ greeting }} {{ auth.user?.firstname }}</h1>
      <span class="grow" />
      <Button v-if="auth.can('client_requests.create')" label="Noter une demande" icon="pi pi-plus" size="small" @click="requests.openQuick()" />
      <Button label="Personnaliser" icon="pi pi-sliders-h" text size="small" :disabled="!data" @click="customize" />
    </div>

    <div v-if="loading && !data" class="center"><ProgressSpinner /></div>
    <p v-else-if="!visible.length" class="muted">Rien à afficher. « Personnaliser » permet de réafficher les widgets masqués.</p>

    <div class="grid">
      <template v-for="key in visible" :key="key">
        <Card v-if="key === 'my_tasks' && w.my_tasks" class="widget">
          <template #title>Mes tâches</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" @click="go('tasks', { mine: '1' })"><b>{{ w.my_tasks!.open }}</b><span>en cours</span></button>
              <button type="button" class="tile" :class="{ danger: w.my_tasks!.overdue }" @click="go('tasks', { mine: '1' })"><b>{{ w.my_tasks!.overdue }}</b><span>en retard</span></button>
              <div class="tile"><b>{{ w.my_tasks!.today }}</b><span>aujourd'hui</span></div>
            </div>
            <ul class="items">
              <li v-for="t in w.my_tasks!.items" :key="t.id"><router-link :to="{ name: 'task', params: { id: t.id } }">{{ t.title }}</router-link><span :class="t.overdue ? 'danger-text' : 'muted'">{{ formatDate(t.due_date) }}</span></li>
            </ul>
          </template>
        </Card>

        <Card v-else-if="key === 'client_requests' && w.client_requests" class="widget">
          <template #title>Demandes clients</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" @click="go('client-requests')"><b>{{ w.client_requests!.open }}</b><span>à traiter</span></button>
              <button type="button" class="tile" :class="{ danger: w.client_requests!.late }" @click="go('client-requests')"><b>{{ w.client_requests!.late }}</b><span>en retard (+2 j)</span></button>
              <div class="tile" :class="{ warn: w.client_requests!.reminders }"><b>{{ w.client_requests!.reminders }}</b><span>rappels</span></div>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'revenue' && w.revenue" class="widget wide">
          <template #title>Encaissements</template>
          <template #content>
            <div class="tiles">
              <div class="tile"><b>{{ money(w.revenue!.this_month) }}</b><span>encaissé ce mois
                <template v-if="trend(w.revenue!.this_month, w.revenue!.last_month) !== null"> ({{ trend(w.revenue!.this_month, w.revenue!.last_month)! > 0 ? '+' : '' }}{{ trend(w.revenue!.this_month, w.revenue!.last_month) }} %)</template></span></div>
              <div class="tile"><b>{{ money(w.revenue!.invoiced_this_month) }}</b><span>facturé ce mois</span></div>
            </div>
            <div class="bars" role="img" aria-label="Encaissements des 6 derniers mois">
              <div v-for="(m, i) in w.revenue!.series" :key="m.month" class="bar" :title="`${monthLabel(m.month)} : ${money(m.amount)}`">
                <div class="fill" :style="{ height: `${Math.max(barHeights(w.revenue!.series.map((x) => x.amount))[i]! * 100, 2)}%` }" />
                <span>{{ monthLabel(m.month) }}</span>
              </div>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'receivables' && w.receivables" class="widget">
          <template #title>Impayés</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" @click="go('invoices')"><b>{{ money(w.receivables!.amount) }}</b><span>{{ w.receivables!.count }} facture(s)</span></button>
              <button type="button" class="tile" :class="{ danger: w.receivables!.overdue_count }" @click="go('invoices')"><b>{{ money(w.receivables!.overdue_amount) }}</b><span>{{ w.receivables!.overdue_count }} en retard</span></button>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'quotes' && w.quotes" class="widget">
          <template #title>Devis</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" @click="go('quotes')"><b>{{ w.quotes!.sent }}</b><span>envoyés<template v-if="w.quotes!.sent_amount !== undefined"> · {{ money(w.quotes!.sent_amount) }}</template></span></button>
              <div class="tile"><b>{{ w.quotes!.drafts }}</b><span>brouillons</span></div>
              <div class="tile"><b>{{ w.quotes!.accepted_this_month }}</b><span>acceptés ce mois</span></div>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'team_tasks' && w.team_tasks" class="widget">
          <template #title>Tâches de l'équipe</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" @click="go('tasks')"><b>{{ w.team_tasks!.open }}</b><span>ouvertes</span></button>
              <div class="tile" :class="{ danger: w.team_tasks!.overdue }"><b>{{ w.team_tasks!.overdue }}</b><span>en retard</span></div>
              <div class="tile" :class="{ warn: w.team_tasks!.blocked }"><b>{{ w.team_tasks!.blocked }}</b><span>bloquées</span></div>
              <div class="tile"><b>{{ w.team_tasks!.unassigned }}</b><span>sans personne</span></div>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'sites' && w.sites" class="widget">
          <template #title>Chantiers</template>
          <template #content>
            <p v-if="!w.sites!.items.length" class="muted">Aucun chantier suivi.</p>
            <ul class="items">
              <li v-for="p in w.sites!.items" :key="p.id" class="site">
                <router-link :to="{ name: 'project', params: { id: p.id } }">{{ p.name }}</router-link>
                <ProgressBar :value="p.progress" :show-value="false" class="bar-sm" />
                <span class="muted small">{{ p.progress }} %</span>
              </li>
            </ul>
          </template>
        </Card>

        <Card v-else-if="key === 'contracts' && w.contracts" class="widget">
          <template #title>Contrats</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" @click="go('contracts')"><b>{{ w.contracts!.active }}</b><span>en cours</span></button>
              <button type="button" class="tile" :class="{ warn: w.contracts!.due }" @click="go('contracts', { filtre: 'due' })"><b>{{ w.contracts!.due }}</b><span>à facturer</span></button>
              <div class="tile" :class="{ danger: w.contracts!.ending }"><b>{{ w.contracts!.ending }}</b><span>échéance proche</span></div>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'expenses' && w.expenses" class="widget">
          <template #title>Dépenses</template>
          <template #content>
            <div class="tiles">
              <template v-if="w.expenses!.to_validate !== undefined">
                <button type="button" class="tile" :class="{ warn: w.expenses!.to_validate }" @click="go('expenses')"><b>{{ w.expenses!.to_validate }}</b><span>à valider</span></button>
                <div class="tile"><b>{{ w.expenses!.to_reimburse }}</b><span>à rembourser</span></div>
              </template>
              <button type="button" class="tile" @click="go('expenses')"><b>{{ w.expenses!.my_submitted }}</b><span>mes dépenses en attente · {{ money(w.expenses!.my_submitted_amount) }}</span></button>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'stock' && w.stock" class="widget">
          <template #title>Stock bas</template>
          <template #content>
            <p v-if="!w.stock!.low" class="muted">Aucun article sous son seuil.</p>
            <ul class="items">
              <li v-for="a in w.stock!.items" :key="a.id"><router-link :to="{ name: 'article', params: { id: a.id } }">{{ a.designation }}</router-link><span class="danger-text">{{ a.quantity }} / {{ a.min_quantity }}</span></li>
            </ul>
            <Button v-if="w.stock!.low > w.stock!.items.length" :label="`Voir les ${w.stock!.low} articles`" text size="small" @click="go('stock', { low: '1' })" />
          </template>
        </Card>

        <Card v-else-if="key === 'purchases' && w.purchases" class="widget">
          <template #title>Achats</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" @click="go('purchases')"><b>{{ w.purchases!.awaiting }}</b><span>à réceptionner</span></button>
              <div class="tile"><b>{{ w.purchases!.drafts }}</b><span>brouillons</span></div>
            </div>
          </template>
        </Card>

        <Card v-else-if="key === 'tech_space' && w.tech_space" class="widget">
          <template #title>Espace technicien</template>
          <template #content>
            <div class="tiles">
              <button type="button" class="tile" :class="{ warn: w.tech_space!.to_decide }" @click="go('tech-space', { onglet: 'demandes' })"><b>{{ w.tech_space!.to_decide }}</b><span>demandes à décider</span></button>
              <div class="tile"><b>{{ w.tech_space!.my_pending_requests }}</b><span>mes demandes en attente</span></div>
            </div>
          </template>
        </Card>
      </template>
    </div>

    <Dialog v-model:visible="customizing" header="Personnaliser le tableau de bord" modal :style="{ width: '440px' }">
      <ul class="custom">
        <li v-for="(key, i) in draft.order" :key="key">
          <Checkbox :model-value="!draft.hidden.includes(key)" binary :input-id="`w-${key}`" @update:model-value="draft = toggleWidget(draft, key as DashboardWidgetKey)" />
          <label :for="`w-${key}`" class="grow">{{ DASHBOARD_WIDGETS[key] }}</label>
          <Button icon="pi pi-arrow-up" text rounded size="small" :disabled="i === 0" aria-label="Monter" @click="draft.order = moveWidget(draft.order, key, -1)" />
          <Button icon="pi pi-arrow-down" text rounded size="small" :disabled="i === draft.order.length - 1" aria-label="Descendre" @click="draft.order = moveWidget(draft.order, key, 1)" />
        </li>
      </ul>
      <template #footer>
        <Button label="Annuler" text severity="secondary" @click="customizing = false" />
        <Button label="Enregistrer" icon="pi pi-check" @click="saveLayout" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.widget.wide {
  grid-column: span 2;
}

@media (max-width: 720px) {
  .widget.wide {
    grid-column: span 1;
  }
}

.tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tile {
  flex: 1 1 90px;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--p-content-hover-background);
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
}

button.tile {
  cursor: pointer;
}

.tile b {
  font-size: 1.35rem;
}

.tile span {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.tile.danger b,
.danger-text {
  color: var(--p-red-500);
}

.tile.warn b {
  color: var(--p-orange-500);
}

.items {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.items li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.site {
  align-items: center;
}

.bar-sm {
  flex: 0 0 90px;
  height: 0.4rem;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 140px;
  margin-top: 1rem;
}

.bar {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 0.25rem;
}

.fill {
  width: 100%;
  max-width: 48px;
  border-radius: 4px 4px 0 0;
  background: var(--p-primary-color);
}

.bar span {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.custom {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.custom li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.center {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.grow {
  flex: 1;
}

.small {
  font-size: 0.8rem;
}
</style>
