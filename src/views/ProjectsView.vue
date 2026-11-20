<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DataTable, { type DataTablePageEvent, type DataTableRowClickEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import SelectButton from 'primevue/selectbutton'
import ToggleButton from 'primevue/togglebutton'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { Project, ProjectFilters } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ClientLogo from '@/components/ClientLogo.vue'
import ProjectFormDialog from '@/components/ProjectFormDialog.vue'
import { periodLabel, projectStatusSeverity } from '@/utils/projects'

const auth = useAuthStore()
const toast = useToast()
const router = useRouter()

type Scope = 'active' | 'completed' | 'all'

const projects = ref<Project[]>([])
const total = ref(0)
const loading = ref(false)
const filters = reactive({ scope: 'active' as Scope, search: '', mine: false, favorite: false, page: 1, per_page: 25 })
const dialogOpen = ref(false)

const scopes = [
  { value: 'active', label: 'En cours et à venir' },
  { value: 'completed', label: 'Terminés' },
  { value: 'all', label: 'Tous' },
]

function scopeFilters(scope: Scope): ProjectFilters {
  if (scope === 'active') return { active: true }
  if (scope === 'completed') return { status: 'completed,cancelled' }
  return {}
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.projects.list({
      ...scopeFilters(filters.scope),
      search: filters.search || undefined,
      manager: filters.mine ? 'me' : undefined,
      favorite: filters.favorite || undefined,
      page: filters.page,
      per_page: filters.per_page,
    })
    projects.value = result.data
    total.value = result.meta.total
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: e instanceof ApiError ? e.message : undefined, life: 5000 })
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      filters.page = 1
      void load()
    }, 300)
  },
)
watch(
  () => [filters.scope, filters.mine, filters.favorite],
  () => {
    filters.page = 1
    void load()
  },
)

function onPage(event: DataTablePageEvent): void {
  filters.page = event.page + 1
  filters.per_page = event.rows
  void load()
}

function open(event: DataTableRowClickEvent): void {
  void router.push({ name: 'project', params: { id: (event.data as Project).id } })
}

function onSaved(project: Project): void {
  toast.add({ severity: 'success', summary: 'Projet créé', detail: project.name, life: 3000 })
  void router.push({ name: 'project', params: { id: project.id } })
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Projets</h1>
      <Button v-if="auth.can('projects.create')" label="Nouveau projet" icon="pi pi-plus" @click="dialogOpen = true" />
    </div>

    <div class="filters">
      <SelectButton v-model="filters.scope" :options="scopes" option-label="label" option-value="value" :allow-empty="false" />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Projet, client, adresse" />
      </IconField>
      <ToggleButton v-model="filters.mine" on-label="Mes projets" off-label="Mes projets" on-icon="pi pi-user" off-icon="pi pi-user" />
      <ToggleButton v-model="filters.favorite" on-label="Favoris" off-label="Favoris" on-icon="pi pi-star-fill" off-icon="pi pi-star" />
    </div>

    <DataTable
      :value="projects"
      :loading="loading"
      lazy
      paginator
      :rows="filters.per_page"
      :total-records="total"
      :rows-per-page-options="[25, 50, 100]"
      data-key="id"
      striped-rows
      row-hover
      class="clickable"
      @page="onPage"
      @row-click="open"
    >
      <template #empty>Aucun projet.</template>
      <Column header="Projet">
        <template #body="{ data }">
          <div class="identity">
            <ClientLogo :name="data.name" :url="data.logo_url" :size="36" />
            <div class="name">
              <strong>
                <i v-if="data.is_favorite" class="pi pi-star-fill favorite" aria-label="Favori" />
                {{ data.name }}
              </strong>
              <span class="muted">{{ data.client?.name }}</span>
            </div>
          </div>
        </template>
      </Column>
      <Column header="Statut" style="width: 9rem">
        <template #body="{ data }">
          <Tag :value="data.status.label" :severity="projectStatusSeverity(data.status.value)" />
        </template>
      </Column>
      <Column header="Chef de projet" style="width: 11rem">
        <template #body="{ data }">{{ data.manager?.full_name ?? '—' }}</template>
      </Column>
      <Column header="Période" style="width: 15rem">
        <template #body="{ data }">
          <span class="muted">{{ periodLabel(data.start_date, data.end_date) || '—' }}</span>
        </template>
      </Column>
      <Column header="" style="width: 8rem">
        <template #body="{ data }">
          <span class="counts muted">
            <span title="Notes"><i class="pi pi-comment" /> {{ data.notes_count ?? 0 }}</span>
            <span title="Documents"><i class="pi pi-paperclip" /> {{ data.documents_count ?? 0 }}</span>
          </span>
        </template>
      </Column>
    </DataTable>

    <ProjectFormDialog v-model:visible="dialogOpen" :project="null" @saved="onSaved" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.name {
  display: flex;
  flex-direction: column;
}

.favorite {
  color: var(--p-yellow-500);
  margin-right: 0.25rem;
}

.counts {
  display: flex;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.clickable :deep(tbody tr) {
  cursor: pointer;
}
</style>
