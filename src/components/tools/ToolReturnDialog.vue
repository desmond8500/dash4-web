<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { ApiError } from '@dash4/shared'
import type { Tool, ToolCondition, ToolLoan, ToolOptions } from '@dash4/shared'
import { api } from '@/services/api'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

/** Retour d'un outil prêté : état constaté (qui devient l'état de l'outil) et remarques. */
const props = defineProps<{ tool: Pick<Tool, 'id' | 'title' | 'condition'> | null; loan: ToolLoan | null; options: ToolOptions | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [tool: Tool] }>()

const condition = ref<ToolCondition>('good')
const notes = ref('')
const error = ref<string | null>(null)
const saving = ref(false)

watch(visible, (open) => {
  if (!open) return
  error.value = null
  condition.value = props.tool?.condition.value ?? 'good'
  notes.value = ''
})

async function save(): Promise<void> {
  if (!props.tool || !props.loan) return
  saving.value = true
  error.value = null
  try {
    emit('saved', await api.tools.returnTool(props.tool.id, props.loan.id, { condition: condition.value, return_notes: notes.value.trim() || null }))
    visible.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="`Retour — ${props.tool?.title ?? ''}`" modal :style="{ width: '480px' }" :breakpoints="{ '520px': '96vw' }">
    <form id="return-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <p v-if="props.loan" class="form-field--full">Rendu par <strong>{{ props.loan.borrower_label }}</strong>.</p>
      <div class="form-field form-field--full">
        <label for="r-cond">État au retour</label>
        <Select id="r-cond" v-model="condition" :options="props.options?.conditions ?? []" option-label="label" option-value="value" />
      </div>
      <div class="form-field form-field--full"><label for="r-notes">Remarques</label><MarkdownEditor id="r-notes" v-model="notes" rows="2" placeholder="Accessoires manquants, dégâts…" /></div>
    </form>
    <template #footer>
      <Button label="Annuler" text severity="secondary" @click="visible = false" />
      <Button label="Enregistrer le retour" icon="pi pi-sign-in" type="submit" form="return-form" :loading="saving" />
    </template>
  </Dialog>
</template>
