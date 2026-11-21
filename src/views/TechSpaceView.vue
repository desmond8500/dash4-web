<script setup lang="ts">
import { markdownToText } from '@dash4/shared'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { TechAccessRequest, TechShare } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import TechShareDialog from '@/components/tech/TechShareDialog.vue'
import AccessDecisionDialog from '@/components/tech/AccessDecisionDialog.vue'
import { formatDateTime } from '@/utils/clientRequests'
import { formatDate } from '@/utils/projects'
import { expiryLabel } from '@/utils/techSpace'

/** Espace technicien : informations temporaires envoyées et demandes d'accès à décider. */
const auth = useAuthStore()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()

const canShares = computed(() => auth.canAny(['tech_shares.view', 'tech_shares.view.own']))
const canRequests = computed(() => auth.canAny(['tech_access_requests.view', 'tech_access_requests.view.own']))
const tab = ref(route.query.onglet === 'demandes' || !canShares.value ? 'demandes' : 'infos')

const shares = ref<TechShare[]>([])
const shareStatus = ref<'active' | 'expired'>('active')
const loadingShares = ref(false)
const shareDialog = ref(false)
const editing = ref<TechShare | null>(null)
const detail = ref<TechShare | null>(null)

const requests = ref<TechAccessRequest[]>([])
const requestFilter = ref<'pending' | 'all'>('pending')
const loadingRequests = ref(false)
const deciding = ref<TechAccessRequest | null>(null)
const decision = ref<'approved' | 'rejected'>('approved')
const decisionOpen = ref(false)

const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)
const statusSeverity = (s: string) => (s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warn')
const reads = (s: TechShare) => `${(s.recipients ?? []).filter((r) => r.read_at).length}/${(s.recipients ?? []).length}`

async function loadShares(): Promise<void> {
  if (!canShares.value) return
  loadingShares.value = true
  try {
    shares.value = (await api.techShares.list({ status: shareStatus.value, per_page: 100 })).data
  } finally {
    loadingShares.value = false
  }
}
async function loadRequests(): Promise<void> {
  if (!canRequests.value) return
  loadingRequests.value = true
  try {
    requests.value = (await api.accessRequests.list({ pending: requestFilter.value === 'pending', per_page: 100 })).data
  } finally {
    loadingRequests.value = false
  }
}
watch(shareStatus, loadShares)
watch(requestFilter, loadRequests)
onMounted(() => Promise.all([loadShares(), loadRequests()]))

function openShare(s: TechShare | null): void {
  editing.value = s
  shareDialog.value = true
}
function onSaved(s: TechShare): void {
  toast.add({ severity: 'success', summary: editing.value ? 'Information modifiée' : 'Information envoyée', life: 3000 })
  if (detail.value?.id === s.id) detail.value = s
  void loadShares()
}
function expireNow(s: TechShare): void {
  confirm.require({
    header: "Effacer l'information",
    message: `Effacer tout de suite le contenu et les fichiers de « ${s.title} » ? Les destinataires ne le verront plus.`,
    acceptProps: { label: 'Effacer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await api.techShares.expire(s.id)
        detail.value = null
        void loadShares()
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Action impossible', detail: errorDetail(e), life: 5000 })
      }
    },
  })
}
function removeShare(s: TechShare): void {
  confirm.require({
    header: "Supprimer l'information",
    message: `Supprimer « ${s.title} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.techShares.remove(s.id)
      detail.value = null
      void loadShares()
    },
  })
}

function decide(r: TechAccessRequest, d: 'approved' | 'rejected'): void {
  deciding.value = r
  decision.value = d
  decisionOpen.value = true
}
function onDecided(r: TechAccessRequest): void {
  toast.add({ severity: r.status.value === 'approved' ? 'success' : 'info', summary: `Demande ${r.status.label.toLowerCase()}`, life: 3000 })
  void loadRequests()
  if (r.tech_share_id) void loadShares()
}
function removeRequest(r: TechAccessRequest): void {
  confirm.require({
    header: 'Supprimer la demande',
    message: `Supprimer la demande « ${r.subject} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.accessRequests.remove(r.id)
      void loadRequests()
    },
  })
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Espace technicien</h1>
      <Button v-if="auth.can('tech_shares.create')" label="Nouvelle information" icon="pi pi-plus" @click="openShare(null)" />
    </div>
    <p class="muted intro">Codes d'accès, matériel, consignes : visibles par les destinataires sur l'application mobile jusqu'à leur expiration, puis effacés.</p>

    <Tabs v-model:value="tab">
      <TabList>
        <Tab v-if="canShares" value="infos">Informations temporaires</Tab>
        <Tab v-if="canRequests" value="demandes">Demandes d'accès <span v-if="requestFilter === 'pending' && requests.length" class="count">{{ requests.length }}</span></Tab>
      </TabList>
      <TabPanels>
        <TabPanel v-if="canShares" value="infos">
          <SelectButton v-model="shareStatus" :options="[{ value: 'active', label: 'En cours' }, { value: 'expired', label: 'Expirées' }]" option-label="label" option-value="value" :allow-empty="false" class="filter" />
          <DataTable :value="shares" :loading="loadingShares" data-key="id" row-hover class="clickable" @row-click="(e) => (detail = e.data)">
            <template #empty>Aucune information {{ shareStatus === 'active' ? 'en cours' : 'expirée' }}.</template>
            <Column header="Information">
              <template #body="{ data }"><strong>{{ data.title }}</strong><div class="muted small">{{ data.category.label }}<template v-if="data.task"> · {{ data.task.title }}</template><template v-else-if="data.project"> · {{ data.project.name }}</template></div></template>
            </Column>
            <Column header="Destinataires">
              <template #body="{ data }">{{ (data.recipients ?? []).map((r: { full_name: string }) => r.full_name).join(', ') }}<div class="muted small">Lu : {{ reads(data) }}</div></template>
            </Column>
            <Column header="Expiration"><template #body="{ data }"><Tag :value="expiryLabel(data)" :severity="data.expired ? 'secondary' : 'info'" /></template></Column>
            <Column header="Par"><template #body="{ data }">{{ data.creator?.full_name ?? '—' }}</template></Column>
          </DataTable>
        </TabPanel>

        <TabPanel v-if="canRequests" value="demandes">
          <SelectButton v-model="requestFilter" :options="[{ value: 'pending', label: 'En attente' }, { value: 'all', label: 'Toutes' }]" option-label="label" option-value="value" :allow-empty="false" class="filter" />
          <DataTable :value="requests" :loading="loadingRequests" data-key="id">
            <template #empty>Aucune demande {{ requestFilter === 'pending' ? 'en attente' : '' }}.</template>
            <Column header="Demande">
              <template #body="{ data }">
                <strong>{{ data.subject }}</strong>
                <div v-if="data.reason" class="muted small pre">{{ data.reason }}</div>
                <div class="muted small"><template v-if="data.task">{{ data.task.title }}</template><template v-else-if="data.project">{{ data.project.name }}</template><template v-if="data.needed_on"> · pour le {{ formatDate(data.needed_on) }}</template></div>
              </template>
            </Column>
            <Column header="Technicien"><template #body="{ data }">{{ data.user?.full_name }}<div class="muted small">{{ formatDateTime(data.created_at) }}</div></template></Column>
            <Column header="Statut">
              <template #body="{ data }">
                <Tag :value="data.status.label" :severity="statusSeverity(data.status.value)" />
                <div v-if="data.decider" class="muted small">{{ data.decider.full_name }}<template v-if="data.response"> : {{ markdownToText(data.response) }}</template></div>
              </template>
            </Column>
            <Column header="" class="actions-col">
              <template #body="{ data }">
                <div class="row-actions">
                  <template v-if="data.can.decide">
                    <Button label="Accepter" icon="pi pi-check" size="small" severity="success" @click="decide(data, 'approved')" />
                    <Button label="Refuser" icon="pi pi-times" size="small" severity="danger" outlined @click="decide(data, 'rejected')" />
                  </template>
                  <Button v-if="data.can.delete" icon="pi pi-trash" size="small" text severity="secondary" aria-label="Supprimer" @click="removeRequest(data)" />
                </div>
              </template>
            </Column>
          </DataTable>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <Dialog :visible="!!detail" :header="detail?.title" modal :style="{ width: '640px' }" :breakpoints="{ '680px': '95vw' }" @update:visible="(v: boolean) => !v && (detail = null)">
      <template v-if="detail">
        <p class="muted small">{{ detail.category.label }} · {{ expiryLabel(detail) }}<template v-if="detail.task"> · {{ detail.task.title }}</template></p>
        <p v-if="detail.content" class="pre content">{{ detail.content }}</p>
        <p v-else class="muted">{{ detail.expired ? 'Contenu effacé à l\'expiration.' : 'Pas de texte.' }}</p>
        <h3>Destinataires</h3>
        <ul class="recipients">
          <li v-for="r in detail.recipients" :key="r.id">
            <i :class="r.read_at ? 'pi pi-check-circle ok' : 'pi pi-circle muted'" /> {{ r.full_name }}
            <span class="muted small">{{ r.read_at ? `lu le ${formatDateTime(r.read_at)}` : 'pas encore lu' }}</span>
          </li>
        </ul>
        <template v-if="!detail.expired">
          <h3>Fichiers</h3>
          <AttachmentsPanel kind="documents" type="tech-shares" :id="detail.id" :can-add="detail.can.update" :can-manage="detail.can.update" />
        </template>
      </template>
      <template #footer>
        <template v-if="detail">
          <Button v-if="detail.can.delete" label="Supprimer" icon="pi pi-trash" severity="danger" text @click="removeShare(detail)" />
          <Button v-if="detail.can.update" label="Effacer maintenant" icon="pi pi-eraser" severity="secondary" outlined @click="expireNow(detail)" />
          <Button v-if="detail.can.update" label="Modifier" icon="pi pi-pencil" @click="openShare(detail)" />
        </template>
      </template>
    </Dialog>

    <TechShareDialog v-model:visible="shareDialog" :share="editing" @saved="onSaved" />
    <AccessDecisionDialog v-model:visible="decisionOpen" :request="deciding" :decision="decision" @decided="onDecided" />
  </div>
</template>

<style scoped>
.intro {
  margin-top: -0.5rem;
}

.filter {
  margin-bottom: 0.75rem;
}

.small {
  font-size: 0.8rem;
}

.pre {
  white-space: pre-wrap;
}

.content {
  padding: 0.75rem;
  border-radius: 6px;
  background: var(--p-content-hover-background);
  font-family: ui-monospace, monospace;
}

.recipients {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ok {
  color: var(--p-green-500);
}

.row-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

.count {
  margin-left: 0.375rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-content-hover-background);
  font-size: 0.75rem;
}

:deep(.clickable tbody tr) {
  cursor: pointer;
}
</style>
