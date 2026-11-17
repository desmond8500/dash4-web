<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { ApiError, ROLE_LABELS } from '@dash4/shared'
import type { AccountType, RoleName, User } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import UserFormDialog from '@/components/UserFormDialog.vue'

const auth = useAuthStore()
const toast = useToast()

const users = ref<User[]>([])
const total = ref(0)
const loading = ref(false)
const filters = reactive({
  search: '',
  account_type: null as AccountType | null,
  is_active: true as boolean | null,
  role: null as RoleName | null,
  page: 1,
  per_page: 25,
})

const dialogOpen = ref(false)
const editedUser = ref<User | null>(null)

const accountTypeOptions = [
  { label: 'Tous les types', value: null },
  { label: 'Gestionnaires', value: 'manager' },
  { label: 'Techniciens', value: 'technician' },
]
const statusOptions = [
  { label: 'Actifs', value: true },
  { label: 'Désactivés', value: false },
  { label: 'Tous', value: null },
]
const roleOptions = [
  { label: 'Tous les profils', value: null },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ label, value })),
]

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.users.list({
      search: filters.search || undefined,
      account_type: filters.account_type ?? undefined,
      is_active: filters.is_active ?? undefined,
      role: filters.role ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    })
    users.value = result.data
    total.value = result.meta.total
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Chargement impossible',
      detail: e instanceof ApiError ? e.message : undefined,
      life: 5000,
    })
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
  () => [filters.account_type, filters.is_active, filters.role],
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

function openCreate(): void {
  editedUser.value = null
  dialogOpen.value = true
}

function openEdit(user: User): void {
  editedUser.value = user
  dialogOpen.value = true
}

function onSaved(user: User): void {
  toast.add({ severity: 'success', summary: 'Utilisateur enregistré', detail: user.full_name, life: 3000 })
  void load()
}

/** Seul un administrateur modifie un administrateur (règle aussi vérifiée par l'API). */
function canEdit(user: User): boolean {
  if (!auth.can('users.manage')) return false
  return !user.roles.some((r) => r.name === 'admin') || auth.isAdmin
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Jamais'
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Utilisateurs</h1>
      <Button v-if="auth.can('users.manage')" label="Nouvel utilisateur" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="filters">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Rechercher un nom ou un e-mail" />
      </IconField>
      <Select v-model="filters.account_type" :options="accountTypeOptions" option-label="label" option-value="value" />
      <Select v-model="filters.role" :options="roleOptions" option-label="label" option-value="value" />
      <Select v-model="filters.is_active" :options="statusOptions" option-label="label" option-value="value" />
    </div>

    <DataTable
      :value="users"
      :loading="loading"
      lazy
      paginator
      :rows="filters.per_page"
      :total-records="total"
      :rows-per-page-options="[25, 50, 100]"
      data-key="id"
      striped-rows
      @page="onPage"
    >
      <template #empty>Aucun utilisateur.</template>

      <Column header="Nom">
        <template #body="{ data }">
          <div class="name">
            <strong>{{ data.full_name }}</strong>
            <span class="muted">{{ data.job_title }}</span>
          </div>
        </template>
      </Column>
      <Column field="email" header="E-mail" />
      <Column header="Type">
        <template #body="{ data }">{{ data.account_type.label }}</template>
      </Column>
      <Column header="Profils">
        <template #body="{ data }">
          <div class="tags">
            <Tag v-for="role in data.roles" :key="role.name" :value="role.label" severity="secondary" />
          </div>
        </template>
      </Column>
      <Column header="Statut">
        <template #body="{ data }">
          <Tag :value="data.is_active ? 'Actif' : 'Désactivé'" :severity="data.is_active ? 'success' : 'danger'" />
        </template>
      </Column>
      <Column header="Dernière connexion">
        <template #body="{ data }">{{ formatDate(data.last_login_at) }}</template>
      </Column>
      <Column header="" style="width: 4rem">
        <template #body="{ data }">
          <Button
            v-if="canEdit(data)"
            icon="pi pi-pencil"
            text
            rounded
            aria-label="Modifier"
            @click="openEdit(data)"
          />
        </template>
      </Column>
    </DataTable>

    <UserFormDialog v-model:visible="dialogOpen" :user="editedUser" @saved="onSaved" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.name {
  display: flex;
  flex-direction: column;
}

.tags {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}
</style>
