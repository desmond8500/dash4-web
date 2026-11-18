<script setup lang="ts">
import { reactive, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import type { ProposalOptions, Quote } from '@dash4/shared'
import { api } from '@/services/api'

/**
 * Proposition technique : ce qui apparaît sur son PDF. Le texte de chaque section
 * s'écrit dans la section (« Proposition technique »).
 */
const props = defineProps<{ quote: Quote; canEdit: boolean; canSeePrices: boolean; busy: boolean }>()
const emit = defineEmits<{ run: [action: () => Promise<Quote>]; pdf: [] }>()

const options = reactive<ProposalOptions>({ ...props.quote.proposal_options })
watch(() => props.quote.proposal_options, (o) => Object.assign(options, o))

const checks: Array<{ key: keyof ProposalOptions; label: string }> = [
  { key: 'show_logo', label: 'Logo' },
  { key: 'show_client', label: 'Nom du client' },
  { key: 'show_project', label: 'Projet' },
  { key: 'show_introduction', label: 'Introduction du devis' },
  { key: 'show_lines', label: 'Liste des équipements' },
  { key: 'show_prices', label: 'Prix' },
  { key: 'show_footer', label: 'En-tête et pied de page' },
]

function toggle(key: keyof ProposalOptions, value: boolean): void {
  ;(options as unknown as Record<string, unknown>)[key] = value
  save({ [key]: value })
}

function save(patch: Partial<ProposalOptions>): void {
  emit('run', () => api.quotes.update(props.quote.id, { proposal_options: patch }))
}

const sectionsWithText = () => (props.quote.sections ?? []).filter((s) => s.is_visible && s.proposal?.trim()).length
</script>

<template>
  <div class="panel">
    <p class="muted">
      Document qui décrit la solution, section par section, sans forcément montrer les prix.
      {{ sectionsWithText() }} section(s) sur {{ (props.quote.sections ?? []).filter((s) => s.is_visible).length }} ont un texte : il s'écrit
      sous chaque section, rubrique « Proposition technique ».
    </p>
    <div class="checks">
      <label v-for="c in checks" :key="c.key" class="check">
        <Checkbox
          :model-value="!!options[c.key]"
          binary
          :disabled="!props.canEdit || (c.key === 'show_prices' && !props.canSeePrices)"
          @update:model-value="(v: boolean) => toggle(c.key, v)"
        />
        {{ c.label }}
      </label>
    </div>
    <div class="form-field">
      <label for="p-client">Nom affiché à la place du client (facultatif, pour une proposition anonyme)</label>
      <InputText
        id="p-client"
        :model-value="options.client_label ?? ''"
        :disabled="!props.canEdit"
        placeholder="Ex. : Un hôtel de Dakar"
        @change="(e: Event) => save({ client_label: (e.target as HTMLInputElement).value.trim() || null })"
      />
    </div>
    <div>
      <Button label="Ouvrir la proposition technique" icon="pi pi-file-pdf" :loading="props.busy" @click="emit('pdf')" />
    </div>
  </div>
</template>

<style scoped>
.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  margin: 0.75rem 0;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
