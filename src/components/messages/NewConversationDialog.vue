<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { ApiError } from '@dash4/shared'
import type { Conversation, ConversationType, MessagingUser, Project } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{ users: MessagingUser[]; projectId?: number | null }>()
const emit = defineEmits<{ created: [conversation: Conversation] }>()
const auth = useAuthStore()

const type = ref<ConversationType>('direct')
const person = ref<number | null>(null)
const people = ref<number[]>([])
const title = ref('')
const projectId = ref<number | null>(null)
const projects = ref<Project[]>([])
const saving = ref(false)
const error = ref('')

const types = [
  { value: 'direct', label: 'Privée' },
  { value: 'group', label: 'Groupe' },
]
const valid = computed(() => (type.value === 'direct' ? person.value !== null : people.value.length > 0 && (title.value.trim() !== '' || projectId.value !== null)))

watch(visible, async (open) => {
  if (!open) return
  error.value = ''
  person.value = null
  people.value = []
  title.value = ''
  projectId.value = props.projectId ?? null
  type.value = props.projectId ? 'group' : 'direct'
  if (!projects.value.length && auth.canAny(['projects.view', 'projects.view.own'])) {
    projects.value = await api.projects.list({ per_page: 100 }).then((r) => r.data).catch(() => [])
  }
})

async function create(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const conversation = await api.messaging.create(
      type.value === 'direct'
        ? { type: 'direct', user_ids: [person.value!] }
        : { type: 'group', user_ids: people.value, title: title.value.trim() || null, project_id: projectId.value },
    )
    emit('created', conversation)
    visible.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Nouvelle conversation" :style="{ width: '30rem' }">
    <div class="form">
      <SelectButton v-model="type" :options="types" option-label="label" option-value="value" :allow-empty="false" />
      <label v-if="type === 'direct'">
        Avec
        <Select v-model="person" :options="users" option-label="full_name" option-value="id" filter placeholder="Choisir une personne" />
      </label>
      <template v-else>
        <label>Nom du groupe <InputText v-model="title" placeholder="Équipe chantier…" /></label>
        <label>
          Participants
          <MultiSelect v-model="people" :options="users" option-label="full_name" option-value="id" filter display="chip" placeholder="Choisir" />
        </label>
        <label v-if="projects.length">
          Projet (facultatif)
          <Select v-model="projectId" :options="projects" option-label="name" option-value="id" filter show-clear placeholder="Aucun" />
        </label>
      </template>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Démarrer" icon="pi pi-comments" :disabled="!valid" :loading="saving" @click="create" />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.error {
  color: var(--p-red-500);
  margin: 0;
}
</style>
