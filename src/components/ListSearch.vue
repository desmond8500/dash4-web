<script setup lang="ts">
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

/** Champ de recherche d'une liste (filtre sur place, sans accents ni majuscules). */
const model = defineModel<string>({ required: true })
const props = withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: 'Rechercher…' })
</script>

<template>
  <IconField class="list-search">
    <InputIcon class="pi pi-search" />
    <InputText v-model="model" :placeholder="props.placeholder" :aria-label="props.placeholder" type="search" />
  </IconField>
</template>

<style scoped>
.list-search {
  max-width: 24rem;
}
.list-search :deep(input) {
  width: 100%;
}
</style>
