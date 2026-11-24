<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import ProgressSpinner from 'primevue/progressspinner'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { ApiError, formatMoney, loanDueText, qrSvg, toolQrContent, toolSeverity } from '@dash4/shared'
import type { Tool, ToolLoan, ToolOptions } from '@dash4/shared'
import { api } from '@/services/api'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, fromApiDate, toApiDate } from '@/utils/projects'
import MarkdownView from '@/components/MarkdownView.vue'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import CommentsPanel from '@/components/CommentsPanel.vue'
import ToolFormDialog from '@/components/tools/ToolFormDialog.vue'
import ToolLendDialog from '@/components/tools/ToolLendDialog.vue'
import ToolReturnDialog from '@/components/tools/ToolReturnDialog.vue'
import ToolLabelsDialog from '@/components/tools/ToolLabelsDialog.vue'
import RecordPhoto from '@/components/RecordPhoto.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'

/** Fiche d'un outil : article lié, état, prêt en cours (retour, rappel, prolongation), historique des prêts, documents. */
const props = defineProps<{ id: string }>()
const settings = useSettingsStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const confirm = useConfirm()

const tool = ref<Tool | null>(null)
const options = ref<ToolOptions | null>(null)
const notFound = ref(false)
const TABS = ['fiche', 'prets', 'documents', 'commentaires']
const tab = ref(TABS.includes(String(route.query.onglet)) ? String(route.query.onglet) : 'fiche')
watch(tab, (t) => void router.replace({ query: { ...route.query, onglet: t } }))

const editOpen = ref(false)
const lendOpen = ref(false)
const returnOpen = ref(false)
const dueOpen = ref(false)
const newDue = ref<Date | null>(null)
const loan = computed(() => tool.value?.current_loan ?? null)
const labelsOpen = ref(false)
const qr = computed(() => (tool.value ? qrSvg(toolQrContent(tool.value.id, window.location.origin), { margin: 2, title: tool.value.title }) : ''))
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

async function load(): Promise<void> {
  try {
    tool.value = await api.tools.get(Number(props.id))
  } catch {
    notFound.value = true
  }
}
onMounted(async () => {
  void settings.load()
  await load()
  options.value = await api.tools.options().catch(() => null)
})
watch(() => props.id, load)

async function run(action: () => Promise<Tool>, done?: string): Promise<boolean> {
  try {
    tool.value = await action()
    if (done) toast.add({ severity: 'success', summary: done, life: 2500 })
    return true
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Refusé', detail: errorDetail(e), life: 6000 })
    return false
  }
}

function remind(l: ToolLoan): void {
  void run(() => api.tools.remind(tool.value!.id, l.id), `Rappel envoyé à ${l.borrower_label}`)
}
function openDue(l: ToolLoan): void {
  newDue.value = fromApiDate(l.due_on)
  dueOpen.value = true
}
async function saveDue(): Promise<void> {
  if (await run(() => api.tools.updateLoan(tool.value!.id, loan.value!.id, { due_on: toApiDate(newDue.value) }), 'Date de retour changée')) dueOpen.value = false
}
function removeLoan(l: ToolLoan): void {
  confirm.require({
    header: 'Supprimer le prêt',
    message: `Supprimer ce prêt à ${l.borrower_label} ? À n'utiliser que pour un prêt saisi par erreur.`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: () => void run(() => api.tools.removeLoan(tool.value!.id, l.id)),
  })
}
function removeTool(): void {
  confirm.require({
    header: "Supprimer l'outil",
    message: `Supprimer « ${tool.value!.title} » de l'outillage ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await api.tools.remove(tool.value!.id)
        void router.push({ name: 'tools' })
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Refusé', detail: errorDetail(e), life: 6000 })
      }
    },
  })
}
</script>

<template>
  <div class="page">
    <div v-if="notFound" class="muted">Outil introuvable ou réservé.</div>
    <div v-else-if="!tool" class="center"><ProgressSpinner /></div>
    <template v-else>
      <div class="page-header">
        <Button icon="pi pi-arrow-left" text rounded aria-label="Retour à l'outillage" @click="router.push({ name: 'tools' })" />
        <RecordPhoto
          :url="tool.photo_url ?? tool.image_url"
          :alt="`Photo de ${tool.name}`"
          icon="pi pi-wrench"
          :can-edit="tool.can.update"
          size="96px"
          :upload="async (f) => (tool = await api.photos.upload('tools', tool!.id, f, f.name))"
          :remove="async () => (tool = await api.photos.remove('tools', tool!.id))"
        />
        <div class="grow">
          <h1>{{ tool.name }}</h1>
          <div class="muted">{{ [tool.code, tool.article?.brand, tool.serial_number ? `S/N ${tool.serial_number}` : null].filter(Boolean).join(' · ') }}</div>
        </div>
        <Tag :value="tool.status.label" :severity="toolSeverity(tool.status.value)" />
        <Button v-if="tool.can.lend && !loan && tool.status.value === 'available'" label="Prêter" icon="pi pi-sign-out" @click="lendOpen = true" />
        <Button label="Étiquette QR" icon="pi pi-qrcode" text @click="labelsOpen = true" />
        <Button v-if="tool.can.update" label="Modifier" icon="pi pi-pencil" text @click="editOpen = true" />
        <Button v-if="tool.can.delete" icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="removeTool" />
      </div>

      <Card v-if="loan" class="loan" :class="{ late: loan.state === 'late' }">
        <template #content>
          <div class="loan-row">
            <div class="grow">
              <div>Chez <strong>{{ loan.borrower_label }}</strong><span v-if="loan.borrower_phone" class="muted"> · {{ loan.borrower_phone }}</span></div>
              <div class="muted small">
                Depuis le {{ formatDate(loan.lent_at) }}<span v-if="loan.project"> · projet {{ loan.project.name }}</span><span v-if="loan.lender"> · prêté par {{ loan.lender.full_name }}</span>
                <span v-if="loan.last_reminded_on"> · dernier rappel le {{ formatDate(loan.last_reminded_on) }}</span>
              </div>
              <MarkdownView v-if="loan.notes" :text="loan.notes" class="small" />
            </div>
            <Tag :value="loanDueText(loan)" :severity="toolSeverity(loan.state)" />
            <template v-if="tool.can.lend">
              <Button v-if="loan.borrower_id" icon="pi pi-bell" text rounded aria-label="Envoyer un rappel" title="Envoyer un rappel" @click="remind(loan)" />
              <Button icon="pi pi-calendar" text rounded aria-label="Changer la date de retour" title="Changer la date de retour" @click="openDue(loan)" />
              <Button label="Retour" icon="pi pi-sign-in" @click="returnOpen = true" />
            </template>
          </div>
        </template>
      </Card>

      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="fiche">Fiche</Tab>
          <Tab value="prets">Prêts <span class="count">{{ tool.loans?.length ?? 0 }}</span></Tab>
          <Tab value="documents">Documents</Tab>
          <Tab value="commentaires">Commentaires</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="fiche">
            <Card>
              <template #content>
                <div class="qr-box">
                  <!-- eslint-disable-next-line vue/no-v-html -- SVG produit par qrSvg, titre échappé -->
                  <div class="qr" v-html="qr" />
                  <span class="muted small">À scanner avec l'application mobile</span>
                </div>
                <dl class="facts">
                  <dt>Article du stock</dt>
                  <dd>
                    <RouterLink v-if="tool.article" :to="{ name: 'article', params: { id: tool.article.id } }">{{ tool.article.designation }}</RouterLink>
                    <span v-if="tool.article?.reference" class="muted"> · {{ tool.article.reference }}</span>
                    <span v-if="!tool.article" class="muted">Aucun</span>
                  </dd>
                  <dt>État</dt><dd>{{ tool.condition.label }}</dd>
                  <template v-if="tool.storage_location"><dt>Rangé à</dt><dd>{{ tool.storage_location.name }}</dd></template>
                  <template v-if="tool.acquired_on"><dt>Acquis le</dt><dd>{{ formatDate(tool.acquired_on) }}</dd></template>
                  <template v-if="tool.purchase_value !== undefined && tool.purchase_value !== null">
                    <dt>Valeur d'achat</dt><dd>{{ formatMoney(tool.purchase_value, settings.currency()) }}</dd>
                  </template>
                </dl>
                <MarkdownView v-if="tool.notes" :text="tool.notes" class="notes" />
              </template>
            </Card>
          </TabPanel>

          <TabPanel value="prets">
            <DataTable :value="tool.loans ?? []" data-key="id" striped-rows>
              <template #empty>Cet outil n'a jamais été prêté.</template>
              <Column header="Emprunteur">
                <template #body="{ data }">
                  <strong>{{ data.borrower_label }}</strong>
                  <div v-if="data.project" class="muted small">{{ data.project.name }}</div>
                </template>
              </Column>
              <Column header="Prêté le" style="width: 8rem"><template #body="{ data }">{{ formatDate(data.lent_at) }}</template></Column>
              <Column header="Retour prévu" style="width: 9rem"><template #body="{ data }">{{ data.due_on ? formatDate(data.due_on) : '—' }}</template></Column>
              <Column header="Rendu" style="width: 14rem">
                <template #body="{ data }">
                  <template v-if="data.returned_at">
                    {{ formatDate(data.returned_at) }}<span v-if="data.return_condition" class="muted"> · {{ data.return_condition.label }}</span>
                    <MarkdownView v-if="data.return_notes" :text="data.return_notes" class="small" />
                  </template>
                  <Tag v-else :value="loanDueText(data)" :severity="toolSeverity(data.state)" />
                </template>
              </Column>
              <Column v-if="tool.can.lend" header="" style="width: 4rem">
                <template #body="{ data }"><Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer le prêt" @click="removeLoan(data)" /></template>
              </Column>
            </DataTable>
          </TabPanel>

          <TabPanel value="documents">
            <h3>Photos</h3>
            <PhotoGallery type="tools" :id="tool.id" :can-add="tool.can.update" :can-manage="tool.can.delete" />
            <h3>Documents</h3>
            <AttachmentsPanel kind="documents" type="tools" :id="tool.id" :can-add="tool.can.update" :can-manage="tool.can.delete" />
            <h3>Notes</h3>
            <AttachmentsPanel kind="notes" type="tools" :id="tool.id" :can-add="tool.can.update" :can-manage="tool.can.delete" />
          </TabPanel>
          <TabPanel value="commentaires"><CommentsPanel type="tools" :id="tool.id" /></TabPanel>
        </TabPanels>
      </Tabs>

      <ToolFormDialog v-model:visible="editOpen" :tool="tool" :options="options" @saved="(list) => (tool = list[0] ?? tool)" />
      <ToolLabelsDialog v-model:visible="labelsOpen" :tools="[tool]" />
      <ToolLendDialog v-model:visible="lendOpen" :tool="tool" :options="options" @saved="(t) => (tool = t)" />
      <ToolReturnDialog v-model:visible="returnOpen" :tool="tool" :loan="loan" :options="options" @saved="(t) => (tool = t)" />
      <Dialog v-model:visible="dueOpen" header="Date de retour" modal :style="{ width: '360px' }">
        <DatePicker v-model="newDue" inline date-format="dd/mm/yy" />
        <p class="muted small">Les rappels repartent de zéro avec la nouvelle date.</p>
        <template #footer>
          <Button label="Sans date" text severity="secondary" @click="(newDue = null), saveDue()" />
          <Button label="Enregistrer" icon="pi pi-check" @click="saveDue" />
        </template>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.kind-icon {
  font-size: 1.75rem;
  color: var(--p-primary-color);
}
.grow {
  flex: 1;
}
.loan {
  margin-bottom: 1rem;
  border-left: 4px solid var(--p-primary-color);
}
.loan.late {
  border-left-color: var(--p-red-500);
}
.loan-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.375rem 1rem;
  margin: 0;
}
.facts dt {
  color: var(--p-text-muted-color);
}
.facts dd {
  margin: 0;
}
.notes {
  margin-top: 1rem;
}
.qr-box {
  float: right;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin: 0 0 0.5rem 1rem;
}
.qr {
  width: 120px;
  height: 120px;
  background: #fff;
}
.qr :deep(svg) {
  width: 100%;
  height: 100%;
}
.small {
  font-size: 0.85rem;
}
.count {
  margin-left: 0.25rem;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}
.center {
  display: flex;
  justify-content: center;
  padding: 3rem;
}
</style>
