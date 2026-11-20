<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { BankAccount } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { maskAccount } from '@/utils/company'

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const canManage = auth.can('bank.manage')

const accounts = ref<BankAccount[]>([])
const loading = ref(false)
const revealed = ref<Set<number>>(new Set())
const dialogOpen = ref(false)
const edited = ref<BankAccount | null>(null)
const form = reactive({ label: '', bank_name: '', holder: '', account_number: '', iban: '', bic: '', is_default: false })
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    accounts.value = await api.bankAccounts.list()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    loading.value = false
  }
}

onMounted(load)

function toggleReveal(id: number): void {
  const next = new Set(revealed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  revealed.value = next
}

function open(account: BankAccount | null): void {
  edited.value = account
  errors.value = {}
  Object.assign(form, {
    label: account?.label ?? '',
    bank_name: account?.bank_name ?? '',
    holder: account?.holder ?? '',
    account_number: account?.account_number ?? '',
    iban: account?.iban ?? '',
    bic: account?.bic ?? '',
    is_default: account?.is_default ?? accounts.value.length === 0,
  })
  dialogOpen.value = true
}

const fieldError = (f: string) => errors.value[f]?.[0]

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  const payload = {
    label: form.label.trim() || null,
    bank_name: form.bank_name.trim(),
    holder: form.holder.trim(),
    account_number: form.account_number.trim(),
    iban: form.iban.replace(/\s+/g, ' ').trim() || null,
    bic: form.bic.replace(/\s+/g, '').toUpperCase() || null,
    is_default: form.is_default,
  }
  try {
    if (edited.value) await api.bankAccounts.update(edited.value.id, payload)
    else await api.bankAccounts.create(payload)
    dialogOpen.value = false
    toast.add({ severity: 'success', summary: 'Compte enregistré', detail: 'Les administrateurs ont été prévenus.', life: 3000 })
    await load()
  } catch (e) {
    if (e instanceof ApiError) errors.value = e.errors
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    saving.value = false
  }
}

async function makeDefault(account: BankAccount): Promise<void> {
  await api.bankAccounts.update(account.id, { is_default: true })
  await load()
}

function remove(account: BankAccount): void {
  confirm.require({
    header: 'Supprimer le compte',
    message: `Supprimer le compte ${account.bank_name} ? Il ne sera plus proposé sur les devis et factures.`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.bankAccounts.remove(account.id)
      await load()
    },
  })
}
</script>

<template>
  <div class="panel">
    <div class="toolbar">
      <span class="muted">Numéros chiffrés en base. Chaque modification est notée au journal et signalée aux administrateurs.</span>
      <Button v-if="canManage" label="Ajouter un compte" icon="pi pi-plus" size="small" @click="open(null)" />
    </div>

    <DataTable :value="accounts" :loading="loading" data-key="id">
      <template #empty>Aucun compte bancaire.</template>
      <Column header="Banque">
        <template #body="{ data }">
          <div class="bank">
            <strong>{{ data.bank_name }}</strong>
            <span class="muted">{{ data.label || data.holder }}</span>
          </div>
        </template>
      </Column>
      <Column header="RIB / IBAN">
        <template #body="{ data }">
          <code>{{ revealed.has(data.id) ? data.account_number : maskAccount(data.account_number) }}</code>
          <div v-if="data.iban" class="muted small">
            IBAN {{ revealed.has(data.id) ? data.iban : maskAccount(data.iban) }}
          </div>
        </template>
      </Column>
      <Column header="BIC" style="width: 8rem">
        <template #body="{ data }">{{ data.bic ?? '—' }}</template>
      </Column>
      <Column style="width: 8rem">
        <template #body="{ data }">
          <Tag v-if="data.is_default" value="Par défaut" severity="success" />
          <Button v-else-if="canManage" label="Par défaut" size="small" text @click="makeDefault(data)" />
        </template>
      </Column>
      <Column style="width: 9rem">
        <template #body="{ data }">
          <Button
            :icon="revealed.has(data.id) ? 'pi pi-eye-slash' : 'pi pi-eye'"
            text
            rounded
            :aria-label="revealed.has(data.id) ? 'Masquer' : 'Afficher les numéros'"
            @click="toggleReveal(data.id)"
          />
          <template v-if="canManage">
            <Button icon="pi pi-pencil" text rounded aria-label="Modifier" @click="open(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="remove(data)" />
          </template>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialogOpen" :header="edited ? 'Modifier le compte' : 'Nouveau compte bancaire'" modal :style="{ width: '560px' }" :breakpoints="{ '600px': '95vw' }">
      <form id="bank-form" class="form-grid" @submit.prevent="save">
        <div class="form-field">
          <label for="b-bank">Banque</label>
          <InputText id="b-bank" v-model="form.bank_name" :invalid="!!fieldError('bank_name')" autofocus />
          <small v-if="fieldError('bank_name')" class="field-error">{{ fieldError('bank_name') }}</small>
        </div>
        <div class="form-field">
          <label for="b-label">Libellé (facultatif)</label>
          <InputText id="b-label" v-model="form.label" placeholder="Ex. : Compte courant" />
        </div>
        <div class="form-field form-field--full">
          <label for="b-holder">Titulaire</label>
          <InputText id="b-holder" v-model="form.holder" :invalid="!!fieldError('holder')" />
          <small v-if="fieldError('holder')" class="field-error">{{ fieldError('holder') }}</small>
        </div>
        <div class="form-field form-field--full">
          <label for="b-number">Numéro de compte (RIB)</label>
          <InputText id="b-number" v-model="form.account_number" :invalid="!!fieldError('account_number')" autocomplete="off" />
          <small v-if="fieldError('account_number')" class="field-error">{{ fieldError('account_number') }}</small>
        </div>
        <div class="form-field">
          <label for="b-iban">IBAN</label>
          <InputText id="b-iban" v-model="form.iban" autocomplete="off" />
        </div>
        <div class="form-field">
          <label for="b-bic">BIC / SWIFT</label>
          <InputText id="b-bic" v-model="form.bic" :invalid="!!fieldError('bic')" />
          <small v-if="fieldError('bic')" class="field-error">{{ fieldError('bic') }}</small>
        </div>
        <div class="form-field form-field--full switch">
          <ToggleSwitch v-model="form.is_default" input-id="b-default" />
          <label for="b-default">Compte affiché par défaut sur les devis et factures</label>
        </div>
        <Message class="form-field--full" severity="warn" :closable="false">
          Les administrateurs recevront une notification de ce changement.
        </Message>
      </form>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="dialogOpen = false" />
        <Button label="Enregistrer" icon="pi pi-check" type="submit" form="bank-form" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
}

.bank {
  display: flex;
  flex-direction: column;
}

.small {
  font-size: 0.8rem;
}

.switch {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}
</style>
