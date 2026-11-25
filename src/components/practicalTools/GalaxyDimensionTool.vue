<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { GALAXY_DIMENSION_MAX_LENGTH, galaxyDimensionText } from '@dash4/shared'

/** Texte → codes du clavier de la centrale Galaxy Dimension (calcul local, même table que l'outil d'origine). */
const toast = useToast()
const text = ref('')
const converted = ref('')
const result = computed(() => (converted.value ? galaxyDimensionText(converted.value) : null))
const codesText = computed(() => result.value?.codes.join(' ') ?? '')

function convert(): void {
  converted.value = text.value
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(codesText.value)
    toast.add({ severity: 'success', summary: 'Codes copiés', life: 2000 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Copie impossible', detail: 'Sélectionnez les codes à la main.', life: 4000 })
  }
}
</script>

<template>
  <form class="galaxy" @submit.prevent="convert">
    <label for="galaxy-text" class="label">Entrez un texte :</label>
    <InputText id="galaxy-text" v-model="text" class="text-input" autocomplete="off" placeholder="Ex. Entrée principale" />
    <small class="muted">{{ Array.from(text).length }} caractère(s) — la centrale garde {{ GALAXY_DIMENSION_MAX_LENGTH }} caractères.</small>
    <Button type="submit" label="Convertir" class="convert" :disabled="!text.trim()" />
  </form>

  <section v-if="result" class="result" aria-live="polite">
    <div class="codes-row">
      <code class="codes">{{ codesText || '—' }}</code>
      <Button icon="pi pi-copy" text rounded aria-label="Copier les codes" :disabled="!codesText" @click="copy" />
    </div>

    <Message v-if="result.tooLong" severity="warn" :closable="false">
      {{ Array.from(converted).length }} caractères : la centrale ne garde que les {{ GALAXY_DIMENSION_MAX_LENGTH }} premiers.
    </Message>
    <Message v-if="result.unknown.length" severity="error" :closable="false">
      Sans code sur la centrale (ignoré) : {{ result.unknown.map((c) => `« ${c} »`).join(', ') }}
    </Message>

    <div class="chars">
      <div v-for="(c, i) in result.chars" :key="i" class="char" :class="{ unknown: !c.code, approx: c.approximated }" :title="c.approximated ? 'Lettre sans accent utilisée' : undefined">
        <span class="char-letter">{{ c.char === ' ' ? '␣' : c.char }}</span>
        <span class="char-code">{{ c.code ?? '?' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.galaxy {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 32rem;
}
.label {
  font-weight: 600;
}
.text-input {
  border-color: var(--p-primary-color);
  font-size: 1.1rem;
}
.convert {
  align-self: center;
  margin-top: 0.75rem;
  min-width: 9rem;
  text-transform: uppercase;
  font-weight: 700;
}
.result {
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 3px solid var(--p-primary-color);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.codes-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.codes {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  word-spacing: 0.3em;
  overflow-wrap: anywhere;
}
.chars {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.char {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 2.4rem;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  background: var(--p-content-background);
}
.char.approx {
  border-color: var(--p-yellow-500);
}
.char.unknown {
  border-color: var(--p-red-500);
  color: var(--p-red-500);
}
.char-letter {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}
.char-code {
  font-weight: 700;
}
</style>
