<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { Contact } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ContactFormDialog from '@/components/ContactFormDialog.vue'
import { telHref } from '@/utils/contactLists'

const auth = useAuthStore()
const toast = useToast()

const contacts = ref<Contact[]>([])
const total = ref(0)
const loading = ref(false)
const filters = reactive({ search: '', page: 1, per_page: 25 })
const dialogOpen = ref(false)
const edited = ref<Contact | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await api.contacts.list({
      search: filters.search || undefined,
      page: filters.page,
      per_page: filters.per_page,
    })
    contacts.value = result.data
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

function onPage(event: DataTablePageEvent): void {
  filters.page = event.page + 1
  filters.per_page = event.rows
  void load()
}

function openForm(contact: Contact | null): void {
  edited.value = contact
  dialogOpen.value = true
}

function onSaved(contact: Contact): void {
  toast.add({ severity: 'success', summary: 'Contact enregistré', detail: contact.full_name, life: 3000 })
  void load()
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Contacts</h1>
      <Button v-if="auth.can('clients.create')" label="Nouveau contact" icon="pi pi-plus" @click="openForm(null)" />
    </div>

    <div class="filters">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="filters.search" placeholder="Nom, société, téléphone, e-mail" />
      </IconField>
    </div>

    <DataTable
      :value="contacts"
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
      <template #empty>Aucun contact.</template>
      <Column header="Nom">
        <template #body="{ data }">
          <div class="name">
            <strong>{{ data.civility ? `${data.civility.label} ` : '' }}{{ data.full_name }}</strong>
            <span class="muted">{{ data.job_title }}</span>
          </div>
        </template>
      </Column>
      <Column header="Client / société">
        <template #body="{ data }">
          <RouterLink v-if="data.client" :to="{ name: 'client', params: { id: data.client.id } }">
            {{ data.client.name }}
          </RouterLink>
          <span v-else class="muted">{{ data.company || '—' }}</span>
        </template>
      </Column>
      <Column header="Téléphone">
        <template #body="{ data }">
          <a v-if="data.phone" :href="telHref(data.phone)">{{ data.phone }}</a>
        </template>
      </Column>
      <Column header="E-mail">
        <template #body="{ data }">
          <a v-if="data.email" :href="`mailto:${data.email}`">{{ data.email }}</a>
        </template>
      </Column>
      <Column header="" style="width: 4rem">
        <template #body="{ data }">
          <Button
            v-if="auth.can('clients.update')"
            icon="pi pi-pencil"
            text
            rounded
            aria-label="Modifier"
            @click="openForm(data)"
          />
        </template>
      </Column>
    </DataTable>

    <ContactFormDialog v-model:visible="dialogOpen" :contact="edited" @saved="onSaved" />
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: 0.75rem;
}

.filters :deep(input) {
  width: 22rem;
  max-width: 100%;
}

.name {
  display: flex;
  flex-direction: column;
}

a {
  color: var(--p-primary-color);
}
</style>
