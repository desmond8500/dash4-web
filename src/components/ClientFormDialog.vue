<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '@dash4/shared'
import type { Client, ClientPayload, ClientStatus, ClientType } from '@dash4/shared'
import { api } from '@/services/api'
import ContactListEditor from './ContactListEditor.vue'
import ClientLogo from './ClientLogo.vue'
import { logoError, LOGO_TYPES } from '@/utils/clients'
import {
  emailsToRows,
  phonesToRows,
  rowErrors,
  rowsToEmails,
  rowsToPhones,
  type ListRow,
} from '@/utils/contactLists'

const props = defineProps<{ client: Client | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [client: Client]; logoFailed: [message: string] }>()

class LogoUploadError extends Error {}

const isEdit = computed(() => props.client !== null)

const form = reactive({
  name: '',
  type: 'company' as ClientType,
  status: 'active' as ClientStatus,
  address: '',
  description: '',
  is_favorite: false,
  phones: [] as ListRow[],
  emails: [] as ListRow[],
})
const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
const logoMessage = ref<string | null>(null)
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

const typeOptions = Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const statusOptions = Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))

function setLogo(file: File | null): void {
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoFile.value = file
  logoPreview.value = file ? URL.createObjectURL(file) : null
}

function onLogoPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  logoMessage.value = file ? logoError(file) : null
  setLogo(file && !logoMessage.value ? file : null)
}

watch(visible, async (open) => {
  if (!open) {
    setLogo(null)
    return
  }
  logoMessage.value = null
  errors.value = {}
  generalError.value = null
  let c = props.client
  // La liste ne contient pas toujours les téléphones et e-mails : on recharge la fiche
  if (c && (c.phones === undefined || c.emails === undefined)) c = await api.clients.get(c.id)
  Object.assign(form, {
    name: c?.name ?? '',
    type: c?.type.value ?? 'company',
    status: c?.status.value ?? 'active',
    address: c?.address ?? '',
    description: c?.description ?? '',
    is_favorite: c?.is_favorite ?? false,
    phones: phonesToRows(c?.phones),
    emails: emailsToRows(c?.emails),
  })
})

function fieldError(field: string): string | undefined {
  return errors.value[field]?.[0]
}

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  generalError.value = null

  const payload: ClientPayload = {
    name: form.name.trim(),
    type: form.type,
    status: form.status,
    address: form.address.trim() || null,
    description: form.description.trim() || null,
    is_favorite: form.is_favorite,
    phones: rowsToPhones(form.phones),
    emails: rowsToEmails(form.emails),
  }

  try {
    let saved = props.client
      ? await api.clients.update(props.client.id, payload)
      : await api.clients.create({ ...payload, client_uuid: crypto.randomUUID() })
    if (logoFile.value) {
      try {
        saved = await api.clients.uploadLogo(saved.id, logoFile.value, logoFile.value.name)
      } catch (e) {
        // La fiche est enregistrée ; seul le logo a échoué, on le signale sans bloquer
        generalError.value = null
        emit('saved', saved)
        visible.value = false
        throw new LogoUploadError(e instanceof ApiError ? (e.fieldError('logo') ?? e.message) : 'Envoi du logo impossible.')
      }
    }
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    if (e instanceof LogoUploadError) {
      emit('logoFailed', e.message)
    } else if (e instanceof ApiError) {
      errors.value = e.errors
      generalError.value = Object.keys(e.errors).length ? null : e.message
    } else {
      generalError.value = 'Enregistrement impossible. Réessayez.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="isEdit ? 'Modifier le client' : 'Nouveau client'"
    modal
    :style="{ width: '680px' }"
    :breakpoints="{ '740px': '95vw' }"
  >
    <form id="client-form" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">
        {{ generalError }}
      </Message>

      <div class="form-field form-field--full logo-field">
        <ClientLogo :name="form.name || '?'" :url="logoPreview ?? props.client?.logo_url" :size="56" />
        <div>
          <Button
            :label="logoPreview || props.client?.logo_url ? 'Changer le logo' : 'Choisir un logo'"
            icon="pi pi-image"
            size="small"
            severity="secondary"
            outlined
            @click="($refs.logoInput as HTMLInputElement).click()"
          />
          <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onLogoPicked" />
          <small class="muted logo-hint">JPEG, PNG ou WebP, 2 Mo au plus</small>
          <small v-if="logoMessage" class="field-error">{{ logoMessage }}</small>
        </div>
      </div>

      <div class="form-field form-field--full">
        <label for="client-name">Nom</label>
        <InputText id="client-name" v-model="form.name" :invalid="!!fieldError('name')" required autofocus />
        <small v-if="fieldError('name')" class="field-error">{{ fieldError('name') }}</small>
      </div>

      <div class="form-field">
        <label for="client-type">Type</label>
        <Select id="client-type" v-model="form.type" :options="typeOptions" option-label="label" option-value="value" />
      </div>

      <div class="form-field">
        <label for="client-status">Statut</label>
        <Select
          id="client-status"
          v-model="form.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="form-field form-field--full">
        <label for="client-address">Adresse</label>
        <InputText id="client-address" v-model="form.address" :invalid="!!fieldError('address')" />
      </div>

      <ContactListEditor
        v-model="form.phones"
        title="Téléphones"
        value-placeholder="Numéro"
        type="tel"
        :errors="rowErrors(errors, 'phones')"
      />
      <ContactListEditor
        v-model="form.emails"
        title="E-mails"
        value-placeholder="Adresse e-mail"
        type="email"
        :errors="rowErrors(errors, 'emails')"
      />

      <div class="form-field form-field--full">
        <label for="client-description">Notes</label>
        <MarkdownEditor id="client-description" v-model="form.description" rows="3" auto-resize />
      </div>

      <div class="form-field form-field--full switch">
        <ToggleSwitch v-model="form.is_favorite" input-id="client-favorite" />
        <label for="client-favorite">Client favori (affiché en premier)</label>
      </div>
    </form>

    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="client-form" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.logo-field {
  flex-direction: row;
  align-items: center;
  gap: 1rem;
}

.logo-hint {
  display: block;
  margin-top: 0.25rem;
}

.switch {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}
</style>
