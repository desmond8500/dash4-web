<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import { useToast } from 'primevue/usetoast'
import { ApiError, formatMoney } from '@dash4/shared'
import type { FlatRate } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

/** Catalogue des forfaits (maintenance, astreinte, intervention…), avec leur prix par période. */
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [rates: FlatRate[]] }>()
const auth = useAuthStore()
const settings = useSettingsStore()
const toast = useToast()

const rates = ref<FlatRate[]>([])
const draft = ref({ designation: '', unit: '', price: 0 })

async function load(): Promise<void> {
  rates.value = await api.contracts.flatRates().catch(() => [])
  emit('changed', rates.value)
}
watch(visible, (open) => open && void load())

async function add(): Promise<void> {
  if (!draft.value.designation.trim()) return
  try {
    await api.contracts.createFlatRate({ designation: draft.value.designation.trim(), unit: draft.value.unit.trim() || null, price: draft.value.price || 0 })
    draft.value = { designation: '', unit: '', price: 0 }
    await load()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ajout impossible', detail: e instanceof ApiError ? e.message : (e as Error).message, life: 5000 })
  }
}
// InputNumber (prix) peut mettre à jour son v-model juste après l'évènement blur : on attend le tick suivant.
async function save(r: FlatRate): Promise<void> {
  await nextTick()
  await api.contracts.updateFlatRate(r.id, { designation: r.designation, unit: r.unit, ...(r.price !== undefined ? { price: r.price } : {}) })
}
async function remove(r: FlatRate): Promise<void> {
  await api.contracts.removeFlatRate(r.id)
  await load()
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Forfaits" modal :style="{ width: '680px' }">
    <table class="list">
      <thead><tr><th>Désignation</th><th style="width:90px">Unité</th><th v-if="auth.can('prices.view')" style="width:170px">Prix</th><th /></tr></thead>
      <tbody>
        <tr v-for="r in rates" :key="r.id">
          <td><InputText v-model="r.designation" fluid :disabled="!auth.can('contracts.update')" @change="save(r)" /></td>
          <td><InputText v-model="r.unit" fluid :disabled="!auth.can('contracts.update')" @change="save(r)" /></td>
          <td v-if="auth.can('prices.view')"><InputNumber v-model="r.price" :min="0" fluid :disabled="!auth.can('contracts.update')" @blur="save(r)" /></td>
          <td><Button v-if="auth.can('contracts.delete')" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Supprimer" @click="remove(r)" /></td>
        </tr>
        <tr v-if="auth.can('contracts.create')">
          <td><InputText v-model="draft.designation" placeholder="Nouveau forfait" fluid /></td>
          <td><InputText v-model="draft.unit" placeholder="mois" fluid /></td>
          <td v-if="auth.can('prices.view')"><InputNumber v-model="draft.price" :min="0" fluid /></td>
          <td><Button icon="pi pi-plus" rounded size="small" aria-label="Ajouter" :disabled="!draft.designation.trim()" @click="add" /></td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rates.length" class="muted small">Aucun forfait.</p>
    <p class="muted small">Exemple : « Maintenance vidéosurveillance », {{ formatMoney(75000, settings.currency()) }} par mois.</p>
  </Dialog>
</template>
