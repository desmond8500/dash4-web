<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { ApiError } from '@dash4/shared'
import type { Project, Tool, ToolOptions } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { toApiDate } from '@/utils/projects'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

/** Prêt d'un outil à un utilisateur de Dash4 ou à une personne extérieure, avec la date de retour prévue. */
const props = defineProps<{ tool: Tool | null; options: ToolOptions | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [tool: Tool] }>()
const auth = useAuthStore()

const projects = ref<Project[]>([])
const error = ref<string | null>(null)
const saving = ref(false)
const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}
const blank = () => ({
  who: 'user' as 'user' | 'external', borrower_id: null as number | null, borrower_name: '', borrower_phone: '',
  project_id: null as number | null, due: inDays(7) as Date | null, notes: '',
})
const form = ref(blank())

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  form.value = blank()
  if (!projects.value.length && auth.canAny(['projects.view', 'projects.view.own'])) {
    projects.value = (await api.projects.list({ per_page: 100, active: true }).catch(() => ({ data: [] as Project[] }))).data
  }
})

async function save(): Promise<void> {
  const f = form.value
  if (!props.tool) return
  if (f.who === 'user' && !f.borrower_id) return void (error.value = "Choisissez à qui l'outil est prêté.")
  if (f.who === 'external' && !f.borrower_name.trim()) return void (error.value = 'Indiquez le nom de la personne.')
  saving.value = true
  error.value = null
  try {
    const saved = await api.tools.lend(props.tool.id, {
      client_uuid: crypto.randomUUID(),
      ...(f.who === 'user' ? { borrower_id: f.borrower_id } : { borrower_name: f.borrower_name.trim(), borrower_phone: f.borrower_phone.trim() || null }),
      project_id: f.project_id, due_on: toApiDate(f.due), notes: f.notes.trim() || null,
    })
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="`Prêter — ${props.tool?.title ?? ''}`" modal :style="{ width: '560px' }" :breakpoints="{ '600px': '96vw' }">
    <form id="lend-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field form-field--full">
        <SelectButton
          v-model="form.who"
          :options="[{ v: 'user', l: 'Un membre de l’équipe' }, { v: 'external', l: 'Une personne extérieure' }]"
          option-label="l"
          option-value="v"
          :allow-empty="false"
          aria-label="Emprunteur"
        />
      </div>
      <div v-if="form.who === 'user'" class="form-field form-field--full">
        <label for="l-user">Prêté à</label>
        <Select id="l-user" v-model="form.borrower_id" :options="props.options?.borrowers ?? []" option-label="full_name" option-value="id" filter placeholder="Choisir une personne" />
      </div>
      <template v-else>
        <div class="form-field"><label for="l-name">Nom</label><InputText id="l-name" v-model="form.borrower_name" placeholder="Sous-traitant, client…" /></div>
        <div class="form-field"><label for="l-phone">Téléphone</label><InputText id="l-phone" v-model="form.borrower_phone" /></div>
      </template>
      <div class="form-field">
        <label for="l-due">À rendre le</label>
        <DatePicker v-model="form.due" input-id="l-due" date-format="dd/mm/yy" :min-date="new Date()" show-button-bar />
      </div>
      <div class="form-field">
        <label for="l-project">Pour le projet</label>
        <Select id="l-project" v-model="form.project_id" :options="[{ id: null, name: 'Aucun' }, ...projects]" option-label="name" option-value="id" filter />
      </div>
      <div class="form-field form-field--full"><label for="l-notes">Notes</label><MarkdownEditor id="l-notes" v-model="form.notes" rows="2" /></div>
      <p class="form-field--full muted small">
        Un rappel part la veille et le jour du retour, puis tous les 3 jours de retard (à l'emprunteur s'il a un compte, et au magasin).
      </p>
    </form>
    <template #footer>
      <Button label="Annuler" text severity="secondary" @click="visible = false" />
      <Button label="Prêter" icon="pi pi-sign-out" type="submit" form="lend-form" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.small {
  font-size: 0.85rem;
}
</style>
