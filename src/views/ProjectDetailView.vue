<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Card from 'primevue/card'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Badge from 'primevue/badge'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { Project, Quote } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ClientLogo from '@/components/ClientLogo.vue'
import ProjectFormDialog from '@/components/ProjectFormDialog.vue'
import AttachmentsPanel from '@/components/AttachmentsPanel.vue'
import QuoteTable from '@/components/quotes/QuoteTable.vue'
import QuoteCreateDialog from '@/components/quotes/QuoteCreateDialog.vue'
import { useSettingsStore } from '@/stores/settings'
import { logoError, LOGO_TYPES } from '@/utils/clients'
import { mapsUrl, periodLabel, projectStatusSeverity } from '@/utils/projects'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const project = ref<Project | null>(null)
const loading = ref(true)
const notFound = ref(false)
const editOpen = ref(false)
const tab = ref('notes')
const logoInput = ref<HTMLInputElement | null>(null)
const logoBusy = ref(false)

const canUpdate = computed(() => project.value?.can_update ?? false)

// Devis du projet
const settings = useSettingsStore()
const canSeeQuotes = computed(() => auth.canAny(['quotes.view', 'quotes.view.own']))
const quotes = ref<Quote[]>([])
const quoteDialog = ref(false)

async function loadQuotes(): Promise<void> {
  if (!canSeeQuotes.value) return
  try {
    quotes.value = (await api.quotes.list({ project_id: Number(props.id), per_page: 100 })).data
  } catch {
    quotes.value = []
  }
}

watch(() => props.id, loadQuotes, { immediate: true })
void settings.load()
const canDelete = computed(() => auth.can('projects.delete'))
const map = computed(() =>
  project.value ? mapsUrl(project.value.latitude, project.value.longitude, project.value.address) : null,
)

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    project.value = await api.projects.get(Number(props.id))
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound.value = true
    else toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

async function toggleFavorite(): Promise<void> {
  if (!project.value) return
  try {
    const updated = await api.projects.update(project.value.id, { is_favorite: !project.value.is_favorite })
    project.value = { ...project.value, is_favorite: updated.is_favorite }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: (e as Error).message, life: 5000 })
  }
}

async function onLogoPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !project.value) return
  const error = logoError(file)
  if (error) {
    toast.add({ severity: 'warn', summary: 'Logo refusé', detail: error, life: 5000 })
    return
  }
  logoBusy.value = true
  try {
    const updated = await api.projects.uploadLogo(project.value.id, file, file.name)
    project.value = { ...project.value, logo_url: updated.logo_url }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Envoi du logo impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    logoBusy.value = false
  }
}

function remove(): void {
  const p = project.value
  if (!p) return
  confirm.require({
    header: 'Supprimer le projet',
    message: `Mettre « ${p.name} » à la corbeille ?`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await api.projects.remove(p.id)
        toast.add({ severity: 'success', summary: 'Projet supprimé', detail: p.name, life: 3000 })
        void router.push({ name: 'projects' })
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Suppression impossible', detail: (e as Error).message, life: 5000 })
      }
    },
  })
}

function onCount(kind: 'notes' | 'links' | 'documents', count: number): void {
  if (project.value) project.value = { ...project.value, [`${kind}_count`]: count }
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !project" class="center"><ProgressSpinner /></div>

    <div v-else-if="notFound" class="center">
      <p>Ce projet n'existe pas, a été supprimé, ou ne fait pas partie de vos projets.</p>
      <RouterLink :to="{ name: 'projects' }">Retour aux projets</RouterLink>
    </div>

    <template v-else-if="project">
      <RouterLink :to="{ name: 'projects' }" class="back"><i class="pi pi-arrow-left" /> Projets</RouterLink>

      <div class="page-header">
        <div class="title">
          <button
            type="button"
            class="logo-button"
            :disabled="!canUpdate || logoBusy"
            :title="canUpdate ? 'Changer le logo du projet' : undefined"
            @click="logoInput?.click()"
          >
            <ClientLogo :name="project.name" :url="project.logo_url" :size="56" />
          </button>
          <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onLogoPicked" />
          <div>
            <h1>{{ project.name }}</h1>
            <RouterLink v-if="project.client" :to="{ name: 'client', params: { id: project.client.id } }" class="muted">
              {{ project.client.name }}
            </RouterLink>
          </div>
          <Tag :value="project.status.label" :severity="projectStatusSeverity(project.status.value)" />
        </div>
        <div class="actions">
          <Button
            v-if="canUpdate"
            :icon="project.is_favorite ? 'pi pi-star-fill' : 'pi pi-star'"
            :aria-label="project.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            severity="secondary"
            text
            rounded
            @click="toggleFavorite"
          />
          <Button v-if="canUpdate" label="Modifier" icon="pi pi-pencil" severity="secondary" @click="editOpen = true" />
          <Button v-if="canDelete" label="Supprimer" icon="pi pi-trash" severity="danger" outlined @click="remove" />
        </div>
      </div>

      <Card>
        <template #content>
          <dl class="details">
            <div>
              <dt>Chef de projet</dt>
              <dd>{{ project.manager?.full_name ?? '—' }}</dd>
            </div>
            <div>
              <dt>Période</dt>
              <dd>{{ periodLabel(project.start_date, project.end_date) || '—' }}</dd>
            </div>
            <div>
              <dt>Adresse du chantier</dt>
              <dd>
                {{ project.address || '—' }}
                <a v-if="map" :href="map" target="_blank" rel="noopener noreferrer" class="map">
                  <i class="pi pi-map-marker" /> Voir sur la carte
                </a>
              </dd>
            </div>
            <div v-if="project.description" class="full">
              <dt>Résumé</dt>
              <dd class="pre">{{ project.description }}</dd>
            </div>
          </dl>
        </template>
      </Card>

      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="notes">Notes <Badge v-if="project.notes_count" :value="project.notes_count" severity="secondary" /></Tab>
          <Tab value="links">Liens <Badge v-if="project.links_count" :value="project.links_count" severity="secondary" /></Tab>
          <Tab value="documents">
            Documents <Badge v-if="project.documents_count" :value="project.documents_count" severity="secondary" />
          </Tab>
          <Tab v-if="canSeeQuotes" value="quotes">Devis <Badge v-if="quotes.length" :value="quotes.length" severity="secondary" /></Tab>
          <Tab value="tasks" disabled>Tâches</Tab>
          <Tab value="journals" disabled>Journaux</Tab>
        </TabList>
        <TabPanels>
          <TabPanel v-for="kind in (['notes', 'links', 'documents'] as const)" :key="kind" :value="kind">
            <AttachmentsPanel
              :kind="kind"
              type="projects"
              :id="project.id"
              :can-add="canUpdate"
              :can-manage="canDelete"
              @changed="onCount(kind, $event)"
            />
          </TabPanel>
          <TabPanel v-if="canSeeQuotes" value="quotes">
            <div class="tab-actions">
              <Button v-if="auth.can('quotes.create')" label="Nouveau devis" icon="pi pi-plus" size="small" @click="quoteDialog = true" />
            </div>
            <QuoteTable :quotes="quotes" :currency="settings.currency()" :show-prices="auth.can('prices.view')" hide-client />
            <QuoteCreateDialog
              v-model:visible="quoteDialog"
              :project-id="project.id"
              @created="(q) => router.push({ name: 'quote', params: { id: q.id } })"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
      <p class="muted soon">Les onglets Tâches et Journaux s'activeront avec ces modules.</p>

      <ProjectFormDialog v-model:visible="editOpen" :project="project" @saved="load" />
    </template>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.title h1 {
  margin: 0;
}

.logo-button {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.logo-button:disabled {
  cursor: default;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem 2rem;
  margin: 0;
}

.details .full {
  grid-column: 1 / -1;
}

dt {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}

dd {
  margin: 0;
}

.pre {
  white-space: pre-line;
}

.map {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.9rem;
}

.tab-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.soon {
  font-size: 0.85rem;
  margin: 0;
}
</style>
