<script setup lang="ts">
import { computed } from 'vue'
import type { Quote, QuoteEmailDocument, QuoteEmailPayload } from '@dash4/shared'
import { api } from '@/services/api'
import DocumentEmailDialog from '@/components/DocumentEmailDialog.vue'

/**
 * Envoi par e-mail depuis un devis :
 * - le devis (par défaut) : PDF joint, et la proposition technique au choix ; un brouillon passe à « Envoyé » ;
 * - `document="proposal"` : la proposition technique seule, sans changer le statut du devis.
 */
const props = withDefaults(defineProps<{ quote: Quote; document?: QuoteEmailDocument }>(), { document: 'quote' })
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ sent: [quote: Quote] }>()

const isProposal = computed(() => props.document === 'proposal')
const hasProposal = computed(() => (props.quote.sections ?? []).some((s) => s.is_visible && !!s.proposal?.trim()))

async function submit(payload: QuoteEmailPayload): Promise<void> {
  emit('sent', await api.quotes.send(props.quote.id, isProposal.value ? { ...payload, attach_proposal: false, document: 'proposal' } : payload))
}
</script>

<template>
  <DocumentEmailDialog
    v-model:visible="visible"
    :header="isProposal ? `Envoyer la proposition technique ${props.quote.number}` : `Envoyer le devis ${props.quote.number}`"
    :attachments="isProposal ? [`Proposition technique ${props.quote.number}.pdf`] : [`${props.quote.number}.pdf`]"
    :load="() => api.quotes.emailDraft(props.quote.id, props.document)"
    :submit="submit"
    :proposal="!isProposal && hasProposal"
    :note="isProposal ? 'Le statut du devis ne change pas.' : 'Un brouillon passe à « Envoyé ».'"
  />
</template>
