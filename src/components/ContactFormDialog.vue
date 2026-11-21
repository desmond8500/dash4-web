<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, CIVILITY_LABELS } from '@dash4/shared'
import type { Civility, Contact, ContactPayload } from '@dash4/shared'
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

/** `clientId` : client auquel rattacher un nouveau contact (depuis la fiche client). */
const props = defineProps<{ contact: Contact | null; clientId?: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [contact: Contact] }>()

const isEdit = computed(() => props.contact !== null)
const hasClient = computed(() => (props.contact ? props.contact.client_id : props.clientId) != null)

const form = reactive({
  civility: null as Civility | null,
  firstname: '',
  lastname: '',
  job_title: '',
  company: '',
  email: '',
  phone: '',
  notes: '',
  phones: [] as ListRow[],
  emails: [] as ListRow[],
})
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

const civilityOptions = [
  { value: null, label: '—' },
  ...Object.entries(CIVILITY_LABELS).map(([value, label]) => ({ value, label })),
]

watch(visible, (open) => {
  if (!open) return
  errors.value = {}
  generalError.value = null
  const c = props.contact
  Object.assign(form, {
    civility: c?.civility?.value ?? null,
    firstname: c?.firstname ?? '',
    lastname: c?.lastname ?? '',
    job_title: c?.job_title ?? '',
    company: c?.company ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    notes: c?.notes ?? '',
    phones: phonesToRows(c?.phones),
    emails: emailsToRows(c?.emails),
  })
})

function fieldError(field: string): string | undefined {
  return errors.value[field]?.[0]
}

const clean = (value: string) => value.trim() || null

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  generalError.value = null

  const payload: ContactPayload = {
    civility: form.civility,
    firstname: form.firstname.trim(),
    lastname: clean(form.lastname),
    job_title: clean(form.job_title),
    company: clean(form.company),
    email: clean(form.email),
    phone: clean(form.phone),
    notes: clean(form.notes),
    phones: rowsToPhones(form.phones),
    emails: rowsToEmails(form.emails),
  }

  try {
    const saved = props.contact
      ? await api.contacts.update(props.contact.id, payload)
      : await api.contacts.create({ ...payload, client_id: props.clientId ?? null, client_uuid: crypto.randomUUID() })
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
    :header="isEdit ? 'Modifier le contact' : 'Nouveau contact'"
    modal
    :style="{ width: '680px' }"
    :breakpoints="{ '740px': '95vw' }"
  >
    <form id="contact-form" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">
        {{ generalError }}
      </Message>

      <div class="form-field">
        <label for="contact-civility">Civilité</label>
        <Select
          id="contact-civility"
          v-model="form.civility"
          :options="civilityOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="form-field">
        <label for="contact-job">Fonction</label>
        <InputText id="contact-job" v-model="form.job_title" />
      </div>

      <div class="form-field">
        <label for="contact-firstname">Prénom</label>
        <InputText id="contact-firstname" v-model="form.firstname" :invalid="!!fieldError('firstname')" required />
        <small v-if="fieldError('firstname')" class="field-error">{{ fieldError('firstname') }}</small>
      </div>

      <div class="form-field">
        <label for="contact-lastname">Nom</label>
        <InputText id="contact-lastname" v-model="form.lastname" :invalid="!!fieldError('lastname')" />
      </div>

      <div class="form-field">
        <label for="contact-phone">Téléphone</label>
        <InputText id="contact-phone" v-model="form.phone" type="tel" :invalid="!!fieldError('phone')" />
        <small v-if="fieldError('phone')" class="field-error">{{ fieldError('phone') }}</small>
      </div>

      <div class="form-field">
        <label for="contact-email">E-mail</label>
        <InputText id="contact-email" v-model="form.email" type="email" :invalid="!!fieldError('email')" />
        <small v-if="fieldError('email')" class="field-error">{{ fieldError('email') }}</small>
      </div>

      <div v-if="!hasClient" class="form-field form-field--full">
        <label for="contact-company">Société</label>
        <InputText id="contact-company" v-model="form.company" />
        <small class="muted">Pour un contact qui n'est pas encore rattaché à un client.</small>
      </div>

      <ContactListEditor
        v-model="form.phones"
        title="Autres téléphones"
        value-placeholder="Numéro"
        type="tel"
        :errors="rowErrors(errors, 'phones')"
      />
      <ContactListEditor
        v-model="form.emails"
        title="Autres e-mails"
        value-placeholder="Adresse e-mail"
        type="email"
        :errors="rowErrors(errors, 'emails')"
      />

      <div class="form-field form-field--full">
        <label for="contact-notes">Notes</label>
        <MarkdownEditor id="contact-notes" v-model="form.notes" rows="3" auto-resize />
      </div>
    </form>

    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="contact-form" :loading="saving" />
    </template>
  </Dialog>
</template>
