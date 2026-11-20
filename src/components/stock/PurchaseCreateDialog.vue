<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError } from '@dash4/shared'
import type { Project, Provider, Purchase } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/** Nouvel achat : fournisseur, projet, objet ; « stock bas » ajoute ses articles sous le seuil. */
const props = defineProps<{ providerId?: number | null; projectId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [purchase: Purchase] }>()
const auth = useAuthStore()

const providers = ref<Provider[]>([])
const projects = ref<Project[]>([])
const providerId = ref<number | null>(null)
const projectId = ref<number | null>(null)
const title = ref('')
const lowStock = ref(false)
const error = ref<string | null>(null)
const saving = ref(false)

watch(visible, async (open) => {
  if (!open) return
  error.value = null
  providerId.value = props.providerId ?? null
  projectId.value = props.projectId ?? null
  title.value = ''
  lowStock.value = false
  const [p, pr] = await Promise.allSettled([
    api.providers.list({ per_page: 100 }),
    auth.canAny(['projects.view', 'projects.view.own']) ? api.projects.list({ per_page: 100 }) : Promise.reject(new Error()),
  ])
  providers.value = p.status === 'fulfilled' ? p.value.data : []
  projects.value = pr.status === 'fulfilled' ? pr.value.data : []
})

async function save(): Promise<void> {
  if (!providerId.value) {
    error.value = 'Choisissez le fournisseur.'
    return
  }
  saving.value = true
  try {
    const purchase = await api.purchases.create({
      client_uuid: crypto.randomUUID(),
      provider_id: providerId.value,
      project_id: projectId.value,
      title: title.value.trim() || null,
      low_stock: lowStock.value,
    })
    visible.value = false
    emit('created', purchase)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Création impossible. Réessayez.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Nouvel achat" modal :style="{ width: '520px' }" :breakpoints="{ '560px': '95vw' }">
    <form id="purchase-create" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field form-field--full">
        <label for="pc-provider">Fournisseur</label>
        <Select id="pc-provider" v-model="providerId" :options="providers" option-label="name" option-value="id" filter placeholder="Choisir" />
        <small class="muted">Nouveau fournisseur : Stock → Fournisseurs et marques.</small>
      </div>
      <div v-if="projects.length" class="form-field form-field--full">
        <label for="pc-project">Projet (facultatif)</label>
        <Select id="pc-project" v-model="projectId" :options="[{ id: null, name: 'Aucun projet' }, ...projects]" option-label="name" option-value="id" filter />
      </div>
      <div class="form-field form-field--full">
        <label for="pc-title">Objet</label>
        <InputText id="pc-title" v-model="title" placeholder="Ex. : réassort caméras" />
      </div>
      <label class="form-field--full check">
        <Checkbox v-model="lowStock" binary />
        Ajouter les articles de ce fournisseur sous leur seuil (quantité pour revenir à deux fois le seuil)
      </label>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Créer le brouillon" icon="pi pi-check" type="submit" form="purchase-create" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
