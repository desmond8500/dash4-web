<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import type { Assignee, ProjectTechnician } from '@dash4/shared'
import { api } from '@/services/api'
import { apiErrorMessage } from '@/utils/errors'

/**
 * Techniciens affectés au projet : ils voient sa partie chantier (bâtiments, plans, systèmes, équipements,
 * PV, DOE) dans l'application mobile, et rien d'autre du projet (ni devis, ni notes, ni prix).
 */
const props = defineProps<{ projectId: number; canEdit: boolean }>()
const toast = useToast()

const assigned = ref<ProjectTechnician[]>([])
const technicians = ref<Assignee[]>([])
const selected = ref<number[]>([])
const editing = ref(false)
const saving = ref(false)
const changed = computed(() => [...selected.value].sort().join() !== assigned.value.map((t) => t.id).sort().join())

onMounted(async () => {
  try {
    assigned.value = await api.sites.technicians(props.projectId)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Techniciens indisponibles', detail: apiErrorMessage(e), life: 5000 })
  }
})

async function edit(): Promise<void> {
  selected.value = assigned.value.map((t) => t.id)
  editing.value = true
  if (technicians.value.length) return
  try {
    technicians.value = (await api.assignees.list()).filter((p) => p.account_type === 'technician')
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Liste des techniciens indisponible', detail: apiErrorMessage(e), life: 5000 })
  }
}

async function save(): Promise<void> {
  saving.value = true
  try {
    assigned.value = await api.sites.setTechnicians(props.projectId, selected.value)
    editing.value = false
    toast.add({ severity: 'success', summary: 'Techniciens enregistrés', detail: 'Les nouveaux techniciens sont prévenus.', life: 3000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: apiErrorMessage(e), life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="techs">
    <div class="techs-head">
      <i class="pi pi-id-card" aria-hidden="true" />
      <strong>Techniciens affectés</strong>
      <span class="muted">— ils voient ce chantier dans l'application mobile, et rien d'autre du projet.</span>
      <Button v-if="props.canEdit && !editing" :label="assigned.length ? 'Modifier' : 'Affecter'" icon="pi pi-user-plus" text size="small" class="push" @click="edit" />
    </div>

    <div v-if="!editing" class="chips">
      <Tag v-for="t in assigned" :key="t.id" :value="t.full_name" severity="secondary" :title="t.job_title ?? undefined" />
      <span v-if="!assigned.length" class="muted">Aucun technicien affecté (ceux qui ont une tâche sur le projet voient aussi le chantier).</span>
    </div>

    <div v-else class="edit">
      <MultiSelect
        v-model="selected"
        :options="technicians"
        option-label="full_name"
        option-value="id"
        filter
        display="chip"
        placeholder="Choisir des techniciens"
        class="grow"
        aria-label="Techniciens affectés"
      />
      <Button label="Annuler" severity="secondary" text @click="editing = false" />
      <Button label="Enregistrer" icon="pi pi-check" :loading="saving" :disabled="!changed" @click="save" />
    </div>
  </section>
</template>

<style scoped>
.techs {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  background: var(--p-content-background);
}
.techs-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}
.techs-head .push {
  margin-left: auto;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.edit {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.grow {
  flex: 1 1 20rem;
}
</style>
