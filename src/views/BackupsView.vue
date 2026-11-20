<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, type Backup } from '@dash4/shared'
import { api } from '@/services/api'
import { daysSinceLast, fileSize } from '@/utils/backups'

const toast = useToast()
const confirm = useConfirm()
const backups = ref<Backup[]>([])
const keepDays = ref(14)
const running = ref(false)
const loading = ref(true)
const late = computed(() => {
  const days = daysSinceLast(backups.value)
  return days === null || days > 1
})

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await api.backups.list()
    backups.value = res.data
    keepDays.value = res.meta.keep_days
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function run(files: boolean): Promise<void> {
  running.value = true
  try {
    await api.backups.run(files)
    toast.add({ severity: 'success', summary: 'Sauvegarde terminée', life: 3000 })
    await load()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Sauvegarde impossible', detail: e instanceof ApiError ? e.message : (e as Error).message, life: 8000 })
  } finally {
    running.value = false
  }
}

async function download(b: Backup): Promise<void> {
  const url = URL.createObjectURL(await api.backups.download(b.name))
  const a = document.createElement('a')
  a.href = url
  a.download = b.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function remove(b: Backup): void {
  confirm.require({
    header: 'Supprimer la sauvegarde',
    message: `Supprimer ${b.name} ? Elle ne pourra plus être restaurée.`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.backups.remove(b.name)
      await load()
    },
  })
}

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Sauvegardes</h1>
      <div class="actions">
        <Button label="Sauvegarder la base" icon="pi pi-database" :loading="running" @click="run(false)" />
        <Button label="Base et fichiers" icon="pi pi-images" severity="secondary" :disabled="running" @click="run(true)" />
      </div>
    </div>

    <Message v-if="!loading && late" severity="warn" :closable="false">
      Aucune sauvegarde de la base depuis plus d'un jour : vérifiez la tâche planifiée « schedule:run » sur le serveur.
    </Message>

    <Card>
      <template #content>
        <p class="muted">
          La base est sauvegardée chaque nuit, la base et les fichiers chaque dimanche. Les sauvegardes sont gardées
          {{ keepDays }} jours sur le serveur. Téléchargez-en une régulièrement et gardez-la ailleurs (disque externe,
          cloud) : une copie sur le même serveur ne protège pas d'une panne de l'hébergeur.
        </p>
        <DataTable :value="backups" :loading="loading" data-key="name" size="small">
          <template #empty>Aucune sauvegarde pour le moment.</template>
          <Column header="Date">
            <template #body="{ data }">{{ when(data.created_at) }}</template>
          </Column>
          <Column header="Contenu">
            <template #body="{ data }">
              <Tag :value="data.kind === 'database' ? 'Base' : 'Fichiers'" :severity="data.kind === 'database' ? 'info' : 'secondary'" />
            </template>
          </Column>
          <Column header="Taille">
            <template #body="{ data }">{{ fileSize(data.size) }}</template>
          </Column>
          <Column header="" style="width: 7rem; text-align: right">
            <template #body="{ data }">
              <Button icon="pi pi-download" text rounded aria-label="Télécharger" title="Télécharger" @click="download(data)" />
              <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="remove(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.5rem;
}
</style>
