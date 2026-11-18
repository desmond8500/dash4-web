<script setup lang="ts">
import type { Invoice, QuoteEmailPayload } from '@dash4/shared'
import { api } from '@/services/api'
import DocumentEmailDialog from '@/components/DocumentEmailDialog.vue'

/** Envoi d'une facture émise par e-mail, PDF joint. */
const props = defineProps<{ invoice: Invoice }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sent: [invoice: Invoice] }>()

async function submit(payload: QuoteEmailPayload): Promise<void> {
  emit('sent', await api.invoices.send(props.invoice.id, payload))
}
</script>

<template>
  <DocumentEmailDialog
    v-model:visible="visible"
    :header="`Envoyer la facture ${props.invoice.number}`"
    :attachments="[`${props.invoice.number}.pdf`]"
    :load="() => api.invoices.emailDraft(props.invoice.id)"
    :submit="submit"
    :proposal="null"
  />
</template>
