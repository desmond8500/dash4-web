<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { ApiError } from '@dash4/shared'
import type { Company } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ClientLogo from '@/components/ClientLogo.vue'
import { logoError, LOGO_TYPES } from '@/utils/clients'

const auth = useAuthStore()
const toast = useToast()
const canEdit = auth.can('company.update')

const company = ref<Company | null>(null)
const form = reactive({
  name: '',
  legal_form: '',
  address: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  website: '',
  ninea: '',
  rccm: '',
  share_capital: '',
  legal_mentions: '',
  terms: '',
})
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)
const logoInput = ref<HTMLInputElement | null>(null)

function fill(c: Company): void {
  company.value = c
  for (const key of Object.keys(form) as Array<keyof typeof form>) form[key] = (c[key] as string | null) ?? ''
}

onMounted(async () => {
  try {
    fill(await api.company.get())
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  }
})

const fieldError = (f: string) => errors.value[f]?.[0]

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  try {
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, k === 'name' ? v.trim() : v.trim() || null]),
    )
    fill(await api.company.update(payload))
    toast.add({ severity: 'success', summary: 'Entreprise enregistrée', life: 2500 })
  } catch (e) {
    if (e instanceof ApiError) errors.value = e.errors
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    saving.value = false
  }
}

async function onLogo(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const error = logoError(file)
  if (error) {
    toast.add({ severity: 'warn', summary: 'Logo refusé', detail: error, life: 5000 })
    return
  }
  try {
    fill(await api.company.uploadLogo(file, file.name))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Envoi du logo impossible', detail: (e as Error).message, life: 5000 })
  }
}

async function removeLogo(): Promise<void> {
  fill(await api.company.removeLogo())
}
</script>

<template>
  <form v-if="company" class="form-grid" @submit.prevent="save">
    <div class="form-field form-field--full logo">
      <ClientLogo :name="form.name || '?'" :url="company.logo_url" :size="72" />
      <div v-if="canEdit" class="logo-actions">
        <Button :label="company.logo_url ? 'Changer le logo' : 'Ajouter le logo'" icon="pi pi-image" size="small" severity="secondary" outlined @click="logoInput?.click()" />
        <Button v-if="company.logo_url" label="Retirer" size="small" text severity="secondary" @click="removeLogo" />
        <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onLogo" />
        <small class="muted">Affiché en tête des devis, factures et rapports.</small>
      </div>
    </div>

    <div class="form-field">
      <label for="c-name">Raison sociale</label>
      <InputText id="c-name" v-model="form.name" :disabled="!canEdit" :invalid="!!fieldError('name')" />
      <small v-if="fieldError('name')" class="field-error">{{ fieldError('name') }}</small>
    </div>
    <div class="form-field">
      <label for="c-form">Forme juridique</label>
      <InputText id="c-form" v-model="form.legal_form" :disabled="!canEdit" placeholder="SARL, SUARL, SA, entreprise individuelle…" />
    </div>
    <div class="form-field">
      <label for="c-ninea">NINEA</label>
      <InputText id="c-ninea" v-model="form.ninea" :disabled="!canEdit" />
    </div>
    <div class="form-field">
      <label for="c-rccm">RCCM</label>
      <InputText id="c-rccm" v-model="form.rccm" :disabled="!canEdit" />
    </div>
    <div class="form-field">
      <label for="c-capital">Capital social</label>
      <InputText id="c-capital" v-model="form.share_capital" :disabled="!canEdit" placeholder="Ex. : 1 000 000 F CFA" />
    </div>
    <div class="form-field">
      <label for="c-phone">Téléphone</label>
      <InputText id="c-phone" v-model="form.phone" type="tel" :disabled="!canEdit" />
    </div>
    <div class="form-field">
      <label for="c-email">E-mail</label>
      <InputText id="c-email" v-model="form.email" type="email" :disabled="!canEdit" :invalid="!!fieldError('email')" />
      <small v-if="fieldError('email')" class="field-error">{{ fieldError('email') }}</small>
    </div>
    <div class="form-field">
      <label for="c-web">Site web</label>
      <InputText id="c-web" v-model="form.website" :disabled="!canEdit" placeholder="https://…" :invalid="!!fieldError('website')" />
      <small v-if="fieldError('website')" class="field-error">{{ fieldError('website') }}</small>
    </div>
    <div class="form-field form-field--full">
      <label for="c-address">Adresse</label>
      <InputText id="c-address" v-model="form.address" :disabled="!canEdit" />
    </div>
    <div class="form-field">
      <label for="c-city">Ville</label>
      <InputText id="c-city" v-model="form.city" :disabled="!canEdit" />
    </div>
    <div class="form-field">
      <label for="c-country">Pays</label>
      <InputText id="c-country" v-model="form.country" :disabled="!canEdit" />
    </div>
    <div class="form-field form-field--full">
      <label for="c-mentions">Mentions légales (pied de page des documents)</label>
      <Textarea id="c-mentions" v-model="form.legal_mentions" rows="3" auto-resize :disabled="!canEdit" />
    </div>
    <div class="form-field form-field--full">
      <label for="c-terms">Conditions générales</label>
      <Textarea id="c-terms" v-model="form.terms" rows="5" auto-resize :disabled="!canEdit" />
    </div>

    <Message v-if="!canEdit" class="form-field--full" severity="info" :closable="false">
      Lecture seule : seuls l'administrateur et le comptable modifient l'entreprise.
    </Message>
    <div v-else class="form-field--full">
      <Button type="submit" label="Enregistrer" icon="pi pi-check" :loading="saving" />
    </div>
  </form>
</template>

<style scoped>
.logo {
  flex-direction: row;
  align-items: center;
  gap: 1rem;
}

.logo-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.logo-actions small {
  flex-basis: 100%;
}
</style>
