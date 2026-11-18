<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '@dash4/shared'
import type { Client, ClientPayload, ClientStatus, ClientType } from '@dash4/shared'
import { api } from '@/services/api'
import ContactListEditor from './ContactListEditor.vue'
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
const emit = defineEmits<{ saved: [client: Client] }>()

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
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

const typeOptions = Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const statusOptions = Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))

watch(visible, async (open) => {
  if (!open) return
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
    const saved = props.client
      ? await api.clients.update(props.client.id, payload)
      : await api.clients.create({ ...payload, client_uuid: crypto.randomUUID() })
    emit('saved', saved)
    visible.value = false
  } catch (e) {
    if (e instanceof ApiError) {
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
        <Textarea id="client-description" v-model="form.description" rows="3" auto-resize />
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
.switch {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}
</style>
