<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError } from '@dash4/shared'
import type { Provider } from '@dash4/shared'
import { api } from '@/services/api'

/** Création ou modification d'un fournisseur, avec sa position (GPS). */
const props = defineProps<{ provider?: Provider | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [provider: Provider] }>()

const form = ref({
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  website: '',
  description: '',
  latitude: null as number | null,
  longitude: null as number | null,
})
const error = ref<string | null>(null)
const locating = ref(false)

watch(visible, (open) => {
  if (!open) return
  error.value = null
  const p = props.provider
  form.value = {
    name: p?.name ?? '',
    contact_name: p?.contact_name ?? '',
    phone: p?.phone ?? '',
    email: p?.email ?? '',
    address: p?.address ?? '',
    website: p?.website ?? '',
    description: p?.description ?? '',
    latitude: p?.latitude ?? null,
    longitude: p?.longitude ?? null,
  }
})

function locate(): void {
  if (!navigator.geolocation) {
    error.value = "La position n'est pas disponible sur cet appareil."
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.value.latitude = Math.round(pos.coords.latitude * 1e7) / 1e7
      form.value.longitude = Math.round(pos.coords.longitude * 1e7) / 1e7
      locating.value = false
    },
    () => {
      error.value = 'Position refusée ou introuvable.'
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 15000 },
  )
}

async function save(): Promise<void> {
  const t = (v: string) => v.trim() || null
  const f = form.value
  const payload = {
    name: f.name.trim(),
    contact_name: t(f.contact_name),
    phone: t(f.phone),
    email: t(f.email),
    address: t(f.address),
    website: t(f.website),
    description: t(f.description),
    latitude: f.latitude,
    longitude: f.longitude,
  }
  try {
    const saved = props.provider
      ? await api.providers.update(props.provider.id, payload)
      : await api.providers.create({ ...payload, client_uuid: crypto.randomUUID() })
    visible.value = false
    emit('saved', saved)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" :header="props.provider ? 'Modifier le fournisseur' : 'Nouveau fournisseur'" modal :style="{ width: '580px' }" :breakpoints="{ '620px': '95vw' }">
    <form id="provider-form" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
      <div class="form-field form-field--full"><label for="p-name">Nom</label><InputText id="p-name" v-model="form.name" autofocus /></div>
      <div class="form-field"><label for="p-contact">Contact</label><InputText id="p-contact" v-model="form.contact_name" /></div>
      <div class="form-field"><label for="p-phone">Téléphone</label><InputText id="p-phone" v-model="form.phone" /></div>
      <div class="form-field"><label for="p-email">E-mail</label><InputText id="p-email" v-model="form.email" type="email" /></div>
      <div class="form-field"><label for="p-web">Site web</label><InputText id="p-web" v-model="form.website" placeholder="https://" /></div>
      <div class="form-field form-field--full"><label for="p-address">Adresse</label><Textarea id="p-address" v-model="form.address" rows="2" auto-resize /></div>
      <div class="form-field"><label for="p-lat">Latitude</label><InputNumber v-model="form.latitude" input-id="p-lat" :min-fraction-digits="0" :max-fraction-digits="7" :min="-90" :max="90" /></div>
      <div class="form-field"><label for="p-lng">Longitude</label><InputNumber v-model="form.longitude" input-id="p-lng" :min-fraction-digits="0" :max-fraction-digits="7" :min="-180" :max="180" /></div>
      <div class="form-field--full">
        <Button label="Utiliser ma position actuelle" icon="pi pi-map-marker" size="small" text :loading="locating" @click="locate" />
        <small class="muted"> (sur place, chez le fournisseur)</small>
      </div>
      <div class="form-field form-field--full"><label for="p-desc">Notes</label><Textarea id="p-desc" v-model="form.description" rows="2" auto-resize /></div>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="provider-form" :disabled="!form.name.trim()" />
    </template>
  </Dialog>
</template>
