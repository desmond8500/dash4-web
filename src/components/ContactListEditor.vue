<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import type { ListRow } from '@/utils/contactLists'

/** Liste éditable de téléphones ou d'e-mails supplémentaires (libellé + valeur). */
const props = defineProps<{
  title: string
  valuePlaceholder: string
  type?: 'tel' | 'email'
  errors?: Record<number, string>
}>()
const rows = defineModel<ListRow[]>({ required: true })

function add(): void {
  rows.value = [...rows.value, { label: '', value: '' }]
}

function remove(index: number): void {
  rows.value = rows.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="form-field form-field--full">
    <label>{{ props.title }}</label>
    <div v-for="(row, index) in rows" :key="index" class="row-wrap">
      <div class="row">
        <InputText v-model="row.label" placeholder="Libellé (bureau, mobile…)" class="row-label" />
        <InputText
          v-model="row.value"
          :type="props.type ?? 'text'"
          :placeholder="props.valuePlaceholder"
          :invalid="!!props.errors?.[index]"
          class="row-value"
        />
        <Button icon="pi pi-trash" severity="secondary" text rounded aria-label="Retirer" @click="remove(index)" />
      </div>
      <small v-if="props.errors?.[index]" class="field-error">{{ props.errors[index] }}</small>
    </div>
    <div>
      <Button label="Ajouter" icon="pi pi-plus" size="small" text @click="add" />
    </div>
  </div>
</template>

<style scoped>
.row-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.row-label {
  width: 12rem;
}

.row-value {
  flex: 1;
}
</style>
