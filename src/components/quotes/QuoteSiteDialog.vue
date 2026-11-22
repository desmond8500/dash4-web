<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { ApiError, quoteSiteCount, quoteSitePayload, quoteSitePlan, type Quote, type QuoteSiteSection, type Site } from '@dash4/shared'
import { api } from '@/services/api'

/**
 * Créer les appareils du chantier depuis les lignes d'un devis :
 * une section → un système du chantier (existant ou nouveau), seules les quantités restantes sont créées.
 */
const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ quoteId?: number | null; projectId?: number | null }>()
const emit = defineEmits<{ done: [site: Site] }>()
const toast = useToast()

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const quote = ref<Quote | null>(null)
const site = ref<Site | null>(null)
const plan = ref<QuoteSiteSection[]>([])
const split = ref(true)

// Depuis le chantier : choisir le devis du projet (les plus avancés d'abord)
const choices = ref<Quote[]>([])
const chosenId = ref<number | null>(null)
const statusRank: Record<string, number> = { accepted: 0, sent: 1, draft: 2 }

watch(visible, async (open) => {
  if (!open) return
  quote.value = null
  plan.value = []
  if (props.quoteId) return load(props.quoteId)
  loading.value = true
  error.value = null
  try {
    const list = (await api.quotes.list({ project_id: props.projectId ?? undefined, per_page: 100 })).data
    choices.value = list.filter((q) => !q.deleted_at).sort((a, b) => (statusRank[a.status.value] ?? 9) - (statusRank[b.status.value] ?? 9))
    if (!choices.value.length) error.value = "Ce projet n'a pas de devis."
    chosenId.value = choices.value[0]?.id ?? null
    if (chosenId.value) await load(chosenId.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

async function load(id: number): Promise<void> {
  loading.value = true
  error.value = null
  try {
    quote.value = await api.quotes.get(id)
    if (!quote.value.project_id) throw new Error("Rattachez d'abord le devis à un projet.")
    site.value = await api.sites.get(quote.value.project_id)
    plan.value = quoteSitePlan(quote.value, site.value)
  } catch (e) {
    error.value = e instanceof ApiError || e instanceof Error ? e.message : 'Chargement impossible'
  } finally {
    loading.value = false
  }
}

const NEW = -1
const systemOptions = (section: QuoteSiteSection) => [
  ...(site.value?.systems ?? []).map((s) => ({ value: s.id, label: s.name })),
  { value: NEW, label: `Nouveau système : ${section.title}` },
]
function setTarget(section: QuoteSiteSection, value: number): void {
  section.installedSystemId = value === NEW ? null : value
  section.systemName = value === NEW ? section.title : (site.value?.systems.find((s) => s.id === value)?.name ?? section.title)
}

const count = computed(() => quoteSiteCount(plan.value, split.value))
const units = computed(() => quoteSiteCount(plan.value, true))
const hasLines = computed(() => plan.value.some((s) => s.lines.some((l) => l.remaining > 0)))

function toggleSection(section: QuoteSiteSection, on: boolean): void {
  section.lines.forEach((l) => (l.selected = on && l.remaining > 0))
}

async function submit(): Promise<void> {
  if (!quote.value) return
  saving.value = true
  try {
    const { site: updated, created } = await api.quotes.toSite(quote.value.id, quoteSitePayload(plan.value, split.value))
    toast.add({ severity: 'success', summary: created ? `${created} appareil${created > 1 ? 's' : ''} ajouté${created > 1 ? 's' : ''} au chantier` : 'Rien de nouveau à ajouter', life: 3500 })
    emit('done', updated)
    visible.value = false
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Création impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Créer les appareils du chantier" modal :style="{ width: '760px', maxWidth: '96vw' }">
    <div v-if="!props.quoteId && choices.length > 1" class="chooser">
      <label for="qs-quote">Devis</label>
      <Select
        input-id="qs-quote"
        v-model="chosenId"
        :options="choices.map((q) => ({ value: q.id, label: `${q.number} — ${q.title} (${q.status.label})` }))"
        option-label="label"
        option-value="value"
        filter
        @update:model-value="(id: number) => load(id)"
      />
    </div>
    <div v-if="loading" class="center"><ProgressSpinner style="width: 2.5rem; height: 2.5rem" /></div>
    <Message v-else-if="error" severity="warn" :closable="false">{{ error }}</Message>
    <template v-else-if="quote">
      <p class="muted intro">
        Chaque section du devis va dans un système du chantier de <strong>{{ quote.project?.name }}</strong>. Seule la quantité qui n'a pas encore d'appareil est créée : on peut relancer sans doublon. La main-d'œuvre n'est pas proposée.
      </p>
      <Message v-if="!plan.length" severity="info" :closable="false">Ce devis n'a pas de matériel.</Message>

      <section v-for="section in plan" :key="section.sectionId" class="section">
        <header>
          <label class="all">
            <Checkbox
              binary
              :model-value="section.lines.some((l) => l.selected)"
              :disabled="!section.lines.some((l) => l.remaining > 0)"
              @update:model-value="toggleSection(section, !!$event)"
            />
            <strong>{{ section.title }}</strong>
          </label>
          <span class="arrow pi pi-arrow-right muted" />
          <Select
            class="target"
            :model-value="section.installedSystemId ?? NEW"
            :options="systemOptions(section)"
            option-label="label"
            option-value="value"
            aria-label="Système du chantier"
            @update:model-value="setTarget(section, $event)"
          />
          <InputText v-if="section.installedSystemId === null" v-model="section.systemName" class="name" aria-label="Nom du nouveau système" />
        </header>
        <ul>
          <li v-for="l in section.lines" :key="l.line.id" :class="{ done: !l.remaining }">
            <Checkbox v-model="l.selected" binary :disabled="!l.remaining" :input-id="`qs-${l.line.id}`" />
            <label :for="`qs-${l.line.id}`" class="designation">
              {{ l.line.designation }}
              <small v-if="l.line.reference" class="muted">{{ l.line.reference }}</small>
            </label>
            <Tag :value="l.line.category.label" severity="secondary" />
            <span class="qty">
              <template v-if="l.remaining">{{ l.remaining }} à créer</template>
              <template v-else>déjà sur le chantier</template>
              <small v-if="l.remaining && Math.ceil(l.line.quantity) > l.remaining" class="muted"> ({{ Math.ceil(l.line.quantity) - l.remaining }} déjà)</small>
            </span>
          </li>
        </ul>
      </section>

      <label v-if="hasLines" class="split">
        <ToggleSwitch v-model="split" />
        <span>
          Un appareil par unité
          <small class="muted">— pour noter le n° de série, l'adresse IP et l'emplacement de chacun. Sinon un appareil avec la quantité.</small>
        </span>
      </label>
      <Message v-if="split && units > 500" severity="warn" :closable="false">Plus de 500 unités : désactivez « Un appareil par unité ».</Message>
    </template>

    <template #footer>
      <Button label="Annuler" text severity="secondary" @click="visible = false" />
      <Button
        :label="count ? `Créer ${count} appareil${count > 1 ? 's' : ''}` : 'Créer les appareils'"
        icon="pi pi-check"
        :disabled="!count || (split && units > 500)"
        :loading="saving"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.chooser {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.chooser :deep(.p-select) {
  flex: 1;
}

.intro {
  margin-top: 0;
}

.section {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.section header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.all {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.target {
  min-width: 14rem;
}

.name {
  flex: 1;
  min-width: 10rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: grid;
  grid-template-columns: auto 1fr auto 9.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-top: 1px solid var(--p-content-border-color);
}

li.done {
  opacity: 0.55;
}

.designation small {
  display: block;
}

.qty {
  text-align: right;
  font-size: 0.9rem;
}

.split {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-top: 0.5rem;
}
</style>
