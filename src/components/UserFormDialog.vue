<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, ROLE_LABELS, rolesForAccountType } from '@dash4/shared'
import type { AccountType, RoleName, User, UserPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ user: User | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ saved: [user: User] }>()

const auth = useAuthStore()
const isEdit = computed(() => props.user !== null)
const isSelf = computed(() => props.user?.id === auth.user?.id)

const form = reactive({
  firstname: '',
  lastname: '',
  email: '',
  phone: '',
  job_title: '',
  account_type: 'manager' as AccountType,
  password: '',
  roles: [] as RoleName[],
  is_active: true,
})
const errors = ref<Record<string, string[]>>({})
const generalError = ref<string | null>(null)
const saving = ref(false)

const accountTypes = [
  { label: 'Gestionnaire', value: 'manager' },
  { label: 'Technicien', value: 'technician' },
]

// Seul un administrateur peut donner le rôle Administrateur (règle aussi vérifiée par l'API)
const roleOptions = computed(() =>
  rolesForAccountType(form.account_type)
    .filter((role) => role !== 'admin' || auth.isAdmin)
    .map((role) => ({ label: ROLE_LABELS[role], value: role })),
)

watch(visible, (open) => {
  if (!open) return
  errors.value = {}
  generalError.value = null
  const u = props.user
  Object.assign(form, {
    firstname: u?.firstname ?? '',
    lastname: u?.lastname ?? '',
    email: u?.email ?? '',
    phone: u?.phone ?? '',
    job_title: u?.job_title ?? '',
    account_type: u?.account_type.value ?? 'manager',
    password: '',
    roles: u?.roles.map((r) => r.name) ?? [],
    is_active: u?.is_active ?? true,
  })
})

// Un technicien n'a que le rôle Technicien
watch(
  () => form.account_type,
  (type) => {
    const allowed = rolesForAccountType(type)
    form.roles = type === 'technician' ? ['technician'] : form.roles.filter((r) => allowed.includes(r))
  },
)

function fieldError(field: string): string | undefined {
  return errors.value[field]?.[0]
}

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  generalError.value = null

  const payload: Partial<UserPayload> = {
    firstname: form.firstname,
    lastname: form.lastname,
    email: form.email,
    phone: form.phone || null,
    job_title: form.job_title || null,
  }
  if (form.password) payload.password = form.password
  // On ne peut pas modifier ses propres rôles, type de compte ou statut
  if (!isSelf.value) {
    payload.account_type = form.account_type
    payload.roles = form.roles
    if (isEdit.value) payload.is_active = form.is_active
  }

  try {
    const saved = props.user
      ? await api.users.update(props.user.id, payload)
      : await api.users.create(payload as UserPayload)
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
    :header="isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'"
    modal
    :style="{ width: '640px' }"
    :breakpoints="{ '700px': '95vw' }"
  >
    <form id="user-form" class="form-grid" @submit.prevent="save">
      <Message v-if="generalError" class="form-field--full" severity="error" :closable="false">
        {{ generalError }}
      </Message>

      <div class="form-field">
        <label for="firstname">Prénom</label>
        <InputText id="firstname" v-model="form.firstname" :invalid="!!fieldError('firstname')" required />
        <small v-if="fieldError('firstname')" class="field-error">{{ fieldError('firstname') }}</small>
      </div>

      <div class="form-field">
        <label for="lastname">Nom</label>
        <InputText id="lastname" v-model="form.lastname" :invalid="!!fieldError('lastname')" required />
        <small v-if="fieldError('lastname')" class="field-error">{{ fieldError('lastname') }}</small>
      </div>

      <div class="form-field">
        <label for="email">E-mail</label>
        <InputText id="email" v-model="form.email" type="email" :invalid="!!fieldError('email')" required />
        <small v-if="fieldError('email')" class="field-error">{{ fieldError('email') }}</small>
      </div>

      <div class="form-field">
        <label for="phone">Téléphone</label>
        <InputText id="phone" v-model="form.phone" :invalid="!!fieldError('phone')" />
        <small v-if="fieldError('phone')" class="field-error">{{ fieldError('phone') }}</small>
      </div>

      <div class="form-field form-field--full">
        <label for="job_title">Fonction</label>
        <InputText id="job_title" v-model="form.job_title" :invalid="!!fieldError('job_title')" />
      </div>

      <template v-if="!isSelf">
        <div class="form-field form-field--full">
          <label>Type de compte</label>
          <SelectButton
            v-model="form.account_type"
            :options="accountTypes"
            option-label="label"
            option-value="value"
            :allow-empty="false"
          />
          <small class="muted">Un technicien utilise uniquement l'application mobile et ne voit jamais les prix.</small>
        </div>

        <div class="form-field form-field--full">
          <label for="roles">Profils</label>
          <MultiSelect
            v-model="form.roles"
            input-id="roles"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            display="chip"
            placeholder="Choisir un ou plusieurs profils"
            :invalid="!!fieldError('roles')"
            :disabled="form.account_type === 'technician'"
            fluid
          />
          <small v-if="fieldError('roles')" class="field-error">{{ fieldError('roles') }}</small>
        </div>

        <div v-if="isEdit" class="form-field form-field--full switch">
          <ToggleSwitch v-model="form.is_active" input-id="is_active" />
          <label for="is_active">Compte actif</label>
        </div>
      </template>

      <div class="form-field form-field--full">
        <label for="password">{{ isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe' }}</label>
        <Password
          v-model="form.password"
          input-id="password"
          toggle-mask
          fluid
          autocomplete="new-password"
          :required="!isEdit"
          :invalid="!!fieldError('password')"
        />
        <small v-if="fieldError('password')" class="field-error">{{ fieldError('password') }}</small>
        <small v-else class="muted">Au moins 10 caractères, avec des lettres et des chiffres.</small>
      </div>
    </form>

    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button type="submit" form="user-form" label="Enregistrer" icon="pi pi-check" :loading="saving" />
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
