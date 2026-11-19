<script setup lang="ts">
import type { Journal, QuoteEmailPayload } from '@dash4/shared'
import { api } from '@/services/api'
import DocumentEmailDialog from '@/components/DocumentEmailDialog.vue'

/** Envoi du rapport d'intervention par e-mail, PDF joint (avec les photos). */
const props = defineProps<{ journal: Journal }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sent: [journal: Journal] }>()

async function submit(payload: QuoteEmailPayload): Promise<void> {
  emit('sent', await api.journals.send(props.journal.id, payload))
}
</script>

<template>
  <DocumentEmailDialog
    v-model:visible="visible"
    header="Envoyer le rapport par e-mail"
    :attachments="[`Rapport ${props.journal.date ?? ''}.pdf`]"
    :load="() => api.journals.emailDraft(props.journal.id)"
    :submit="submit"
    :proposal="null"
  />
</template>
