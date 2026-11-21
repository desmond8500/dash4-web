<script setup lang="ts">
import { markdownToText } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, onMounted, ref } from 'vue'
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
import type { QuoteLineCategory, QuoteSystem, QuoteTemplateSummary } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { linePrice } from '@/utils/quotes'

/** Systèmes (vidéosurveillance, alarme…) et modèles de devis. Gestion : quotes.update + costs.view. */
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToast()
const confirm = useConfirm()
const canManage = computed(() => auth.can('quotes.update') && auth.can('costs.view'))

const systems = ref<QuoteSystem[]>([])
const loose = ref<QuoteTemplateSummary[]>([])
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
type Line = { designation: string; reference: string; category: QuoteLineCategory; unit: string; quantity: number; unit_cost: number; coefficient: number }
const categories = (Object.entries(QUOTE_LINE_CATEGORY_LABELS) as Array<[QuoteLineCategory, string]>).map(([value, label]) => ({ value, label }))
const templateOpen = ref(false)
const templateId = ref<number | null>(null)
const templateForm = ref({ name: '', description: '', system: null as number | null, lines: [] as Line[] })
const errors = ref<Record<string, string[]>>({})

const emptyLine = (): Line => ({ designation: '', reference: '', category: 'other', unit: '', quantity: 1, unit_cost: 0, coefficient: 1 })

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
    templateForm.value = { name: '', description: '', system: systemId, lines: [emptyLine()] }
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

    <Card v-for="system in systems" :key="system.id">
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

    <Card v-if="loose.length">
      <template #title>Sans système</template>
      <template #content>
        <table class="list">
          <tbody>
            <tr v-for="t in loose" :key="t.id">
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

    <Dialog v-model:visible="templateOpen" :header="templateId ? 'Modèle' : 'Nouveau modèle'" modal :style="{ width: '960px' }" :breakpoints="{ '1000px': '96vw' }">
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
          <table class="list lines">
            <thead>
              <tr>
                <th>Désignation</th><th>Référence</th><th style="width: 9rem">Catégorie</th><th style="width: 6rem">Qté</th><th style="width: 4.5rem">Unité</th>
                <template v-if="auth.can('costs.view')"><th style="width: 8rem">Coût</th><th style="width: 5.5rem">Coef.</th></template>
                <th v-if="auth.can('prices.view')" class="num" style="width: 8rem">Montant</th>
                <th v-if="canManage" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(l, i) in templateForm.lines" :key="i">
                <td><InputText v-model="l.designation" class="full" :disabled="!canManage" /></td>
                <td><InputText v-model="l.reference" class="full" :disabled="!canManage" /></td>
                <td><Select v-model="l.category" :options="categories" option-label="label" option-value="value" class="full" :disabled="!canManage" /></td>
                <td><InputNumber v-model="l.quantity" :min="0" :max-fraction-digits="2" class="full" input-class="num-input" :disabled="!canManage" /></td>
                <td><InputText v-model="l.unit" class="full" :disabled="!canManage" /></td>
                <template v-if="auth.can('costs.view')">
                  <td><InputNumber v-model="l.unit_cost" :min="0" class="full" input-class="num-input" :disabled="!canManage" /></td>
                  <td><InputNumber v-model="l.coefficient" :min="0" :max-fraction-digits="4" class="full" input-class="num-input" :disabled="!canManage" /></td>
                </template>
                <td v-if="auth.can('prices.view')" class="num">{{ formatMoney(linePrice(l.unit_cost, l.coefficient, l.quantity).total, settings.currency()) }}</td>
                <td v-if="canManage"><Button icon="pi pi-times" text rounded severity="secondary" aria-label="Retirer" @click="templateForm.lines.splice(i, 1)" /></td>
              </tr>
            </tbody>
            <tfoot v-if="auth.can('prices.view') && auth.can('costs.view')">
              <tr class="strong"><td :colspan="7">Total hors taxes du modèle</td><td class="num">{{ formatMoney(total, settings.currency()) }}</td><td /></tr>
            </tfoot>
          </table>
          <div v-if="canManage"><Button label="Ajouter une ligne" icon="pi pi-plus" size="small" text @click="templateForm.lines.push(emptyLine())" /></div>
        </div>
      </div>
      <template #footer>
        <Button label="Fermer" severity="secondary" text @click="templateOpen = false" />
        <Button v-if="canManage" label="Enregistrer" icon="pi pi-check" :disabled="!templateForm.name.trim()" @click="saveTemplate" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
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

.lines td {
  padding: 0.25rem;
}

:deep(.num-input) {
  text-align: right;
  width: 100%;
}
</style>
