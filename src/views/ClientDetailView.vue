<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { Client, Contact } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ClientFormDialog from '@/components/ClientFormDialog.vue'
import ContactFormDialog from '@/components/ContactFormDialog.vue'
import ClientLogo from '@/components/ClientLogo.vue'
import { logoError, LOGO_TYPES, statusSeverity } from '@/utils/clients'
import { telHref } from '@/utils/contactLists'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()

const client = ref<Client | null>(null)
const loading = ref(true)
const notFound = ref(false)
const clientDialog = ref(false)
const contactDialog = ref(false)
const editedContact = ref<Contact | null>(null)

const contacts = computed(() => client.value?.contacts ?? [])

async function load(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    client.value = await api.clients.get(Number(props.id))
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      notFound.value = true
    } else {
      toast.add({
        severity: 'error',
        summary: 'Chargement impossible',
        detail: e instanceof ApiError ? e.message : undefined,
        life: 5000,
      })
    }
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

async function toggleFavorite(): Promise<void> {
  if (!client.value) return
  try {
    const updated = await api.clients.update(client.value.id, { is_favorite: !client.value.is_favorite })
    client.value = { ...client.value, is_favorite: updated.is_favorite }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: (e as Error).message, life: 5000 })
  }
}

const logoInput = ref<HTMLInputElement | null>(null)
const logoBusy = ref(false)

async function onLogoPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !client.value) return
  const error = logoError(file)
  if (error) {
    toast.add({ severity: 'warn', summary: 'Logo refusé', detail: error, life: 5000 })
    return
  }
  logoBusy.value = true
  try {
    const updated = await api.clients.uploadLogo(client.value.id, file, file.name)
    client.value = { ...client.value, logo_url: updated.logo_url }
  } catch (e) {
    const detail = e instanceof ApiError ? (e.fieldError('logo') ?? e.message) : undefined
    toast.add({ severity: 'error', summary: 'Envoi du logo impossible', detail, life: 5000 })
  } finally {
    logoBusy.value = false
  }
}

async function removeLogo(): Promise<void> {
  if (!client.value) return
  logoBusy.value = true
  try {
    const updated = await api.clients.removeLogo(client.value.id)
    client.value = { ...client.value, logo_url: updated.logo_url }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Suppression du logo impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    logoBusy.value = false
  }
}

function onLogoFailed(message: string): void {
  toast.add({ severity: 'warn', summary: 'Client enregistré, mais pas son logo', detail: message, life: 6000 })
}

function onClientSaved(): void {
  toast.add({ severity: 'success', summary: 'Client enregistré', life: 3000 })
  void load()
}

function removeClient(): void {
  const c = client.value
  if (!c) return
  confirm.require({
    header: 'Supprimer le client',
    message: `Mettre « ${c.name} » à la corbeille ? Ses contacts sont conservés.`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await api.clients.remove(c.id)
        toast.add({ severity: 'success', summary: 'Client supprimé', detail: c.name, life: 3000 })
        void router.push({ name: 'clients' })
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Suppression impossible', detail: (e as Error).message, life: 5000 })
      }
    },
  })
}

function openContact(contact: Contact | null): void {
  editedContact.value = contact
  contactDialog.value = true
}

function onContactSaved(contact: Contact): void {
  toast.add({ severity: 'success', summary: 'Contact enregistré', detail: contact.full_name, life: 3000 })
  void load()
}

function removeContact(contact: Contact): void {
  confirm.require({
    header: 'Supprimer le contact',
    message: `Mettre « ${contact.full_name} » à la corbeille ?`,
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await api.contacts.remove(contact.id)
        void load()
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Suppression impossible', detail: (e as Error).message, life: 5000 })
      }
    },
  })
}

function contactPhones(contact: Contact): string[] {
  return [contact.phone, ...(contact.phones ?? []).map((p) => p.number)].filter((v): v is string => !!v)
}

function contactEmails(contact: Contact): string[] {
  return [contact.email, ...(contact.emails ?? []).map((e) => e.address)].filter((v): v is string => !!v)
}
</script>

<template>
  <div class="page">
    <div v-if="loading && !client" class="center"><ProgressSpinner /></div>

    <div v-else-if="notFound" class="center">
      <p>Ce client n'existe pas ou a été supprimé.</p>
      <RouterLink :to="{ name: 'clients' }">Retour à la liste des clients</RouterLink>
    </div>

    <template v-else-if="client">
      <RouterLink :to="{ name: 'clients' }" class="back"><i class="pi pi-arrow-left" /> Clients</RouterLink>

      <div class="page-header">
        <div class="title">
          <div class="logo-box">
            <ClientLogo :name="client.name" :url="client.logo_url" :size="64" />
            <div v-if="auth.can('clients.update')" class="logo-actions">
              <Button
                :label="client.logo_url ? 'Changer' : 'Ajouter un logo'"
                icon="pi pi-image"
                size="small"
                text
                :loading="logoBusy"
                @click="logoInput?.click()"
              />
              <Button
                v-if="client.logo_url"
                label="Retirer"
                size="small"
                severity="secondary"
                text
                :disabled="logoBusy"
                @click="removeLogo"
              />
              <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" hidden @change="onLogoPicked" />
            </div>
          </div>
          <h1>{{ client.name }}</h1>
          <Tag :value="client.status.label" :severity="statusSeverity(client.status.value)" />
          <Tag :value="client.type.label" severity="secondary" />
        </div>
        <div class="actions">
          <Button
            v-if="auth.can('clients.update')"
            :icon="client.is_favorite ? 'pi pi-star-fill' : 'pi pi-star'"
            :aria-label="client.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            severity="secondary"
            text
            rounded
            @click="toggleFavorite"
          />
          <Button
            v-if="auth.can('clients.update')"
            label="Modifier"
            icon="pi pi-pencil"
            severity="secondary"
            @click="clientDialog = true"
          />
          <Button
            v-if="auth.can('clients.delete')"
            label="Supprimer"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="removeClient"
          />
        </div>
      </div>

      <Card>
        <template #content>
          <dl class="details">
            <div>
              <dt>Adresse</dt>
              <dd>{{ client.address || '—' }}</dd>
            </div>
            <div>
              <dt>Téléphones</dt>
              <dd>
                <template v-if="client.phones?.length">
                  <div v-for="phone in client.phones" :key="phone.id">
                    <a :href="telHref(phone.number)">{{ phone.number }}</a>
                    <span v-if="phone.label" class="muted"> · {{ phone.label }}</span>
                  </div>
                </template>
                <template v-else>—</template>
              </dd>
            </div>
            <div>
              <dt>E-mails</dt>
              <dd>
                <template v-if="client.emails?.length">
                  <div v-for="email in client.emails" :key="email.id">
                    <a :href="`mailto:${email.address}`">{{ email.address }}</a>
                    <span v-if="email.label" class="muted"> · {{ email.label }}</span>
                  </div>
                </template>
                <template v-else>—</template>
              </dd>
            </div>
            <div v-if="client.description" class="full">
              <dt>Notes</dt>
              <dd class="notes">{{ client.description }}</dd>
            </div>
          </dl>
        </template>
      </Card>

      <div class="page-header">
        <h2>Contacts</h2>
        <Button
          v-if="auth.can('clients.create')"
          label="Ajouter un contact"
          icon="pi pi-user-plus"
          size="small"
          @click="openContact(null)"
        />
      </div>

      <DataTable :value="contacts" data-key="id" striped-rows>
        <template #empty>Aucun contact pour ce client.</template>
        <Column header="Nom">
          <template #body="{ data }">
            <div class="name">
              <strong>{{ data.civility ? `${data.civility.label} ` : '' }}{{ data.full_name }}</strong>
              <span class="muted">{{ data.job_title }}</span>
            </div>
          </template>
        </Column>
        <Column header="Téléphone">
          <template #body="{ data }">
            <div v-for="number in contactPhones(data)" :key="number">
              <a :href="telHref(number)">{{ number }}</a>
            </div>
          </template>
        </Column>
        <Column header="E-mail">
          <template #body="{ data }">
            <div v-for="address in contactEmails(data)" :key="address">
              <a :href="`mailto:${address}`">{{ address }}</a>
            </div>
          </template>
        </Column>
        <Column header="" style="width: 7rem">
          <template #body="{ data }">
            <Button
              v-if="auth.can('clients.update')"
              icon="pi pi-pencil"
              text
              rounded
              aria-label="Modifier"
              @click="openContact(data)"
            />
            <Button
              v-if="auth.can('clients.delete')"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              aria-label="Supprimer"
              @click="removeContact(data)"
            />
          </template>
        </Column>
      </DataTable>

      <ClientFormDialog v-model:visible="clientDialog" :client="client" @saved="onClientSaved" @logo-failed="onLogoFailed" />
      <ContactFormDialog
        v-model:visible="contactDialog"
        :contact="editedContact"
        :client-id="client.id"
        @saved="onContactSaved"
      />
    </template>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
}

.back {
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.9rem;
}

.title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.logo-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

h2 {
  margin: 0;
  font-size: 1.15rem;
}

.details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem 2rem;
  margin: 0;
}

.details .full {
  grid-column: 1 / -1;
}

dt {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}

dd {
  margin: 0;
}

.notes {
  white-space: pre-line;
}

.name {
  display: flex;
  flex-direction: column;
}

a {
  color: var(--p-primary-color);
}
</style>
