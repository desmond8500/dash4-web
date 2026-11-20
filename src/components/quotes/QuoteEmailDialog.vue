<script setup lang="ts">
import { computed } from 'vue'
import type { Quote, QuoteEmailPayload } from '@dash4/shared'
import { api } from '@/services/api'
import DocumentEmailDialog from '@/components/DocumentEmailDialog.vue'

/** Envoi du devis par e-mail : PDF joint (et proposition technique) ; un brouillon passe à « Envoyé ». */
const props = defineProps<{ quote: Quote }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sent: [quote: Quote] }>()

const hasProposal = computed(() => (props.quote.sections ?? []).some((s) => s.is_visible && !!s.proposal?.trim()))

async function submit(payload: QuoteEmailPayload): Promise<void> {
  emit('sent', await api.quotes.send(props.quote.id, payload))
}
</script>

<template>
  <DocumentEmailDialog
    v-model:visible="visible"
    :header="`Envoyer le devis ${props.quote.number}`"
    :attachments="[`${props.quote.number}.pdf`]"
    :load="() => api.quotes.emailDraft(props.quote.id)"
    :submit="submit"
    :proposal="hasProposal"
    note="Un brouillon passe à « Envoyé »."
  />
</template>
