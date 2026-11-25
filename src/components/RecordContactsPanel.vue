<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import AutoComplete, { type AutoCompleteCompleteEvent, type AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import type { Contact, ContactableType, RecordContact } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { apiErrorMessage } from '@/utils/errors'
import { CONTACT_ROLES, contactChannels, contactSubtitle, movedIds, unlinkedContacts } from '@/utils/recordContacts'
import ContactFormDialog from '@/components/ContactFormDialog.vue'

/**
 * Contacts liés à un projet ou à un devis, avec leur rôle (maître d'ouvrage, architecte…).
 * Les contacts du client sont proposés en premier ; on peut aussi chercher n'importe quel contact, ou en créer un.
 */
const props = defineProps<{ type: ContactableType; id: number; clientId?: number | null; canEdit: boolean }>()
const emit = defineEmits<{ changed: [count: number] }>()

const auth = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const links = ref<RecordContact[]>([])
const loading = ref(true)
const busy = ref(false)
const editable = computed(() => props.canEdit && auth.can('clients.view'))

// Ajout : recherche, rôle, contacts du client
const picked = ref<Contact | string | null>(null)
const suggestions = ref<Contact[]>([])
const role = ref('')
const clientContacts = ref<Contact[]>([])
const proposed = computed(() => unlinkedContacts(clientContacts.value, links.value))
const createOpen = ref(false)

function setLinks(list: RecordContact[]): void {
  links.value = list
  emit('changed', list.length)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    setLinks(await api.recordContacts.list(props.type, props.id))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Contacts indisponibles', detail: apiErrorMessage(e), life: 5000 })
  } finally {
    loading.value = false
  }
  if (editable.value && props.clientId) {
    try {
      clientContacts.value = (await api.contacts.list({ client_id: props.clientId, per_page: 100 })).data
    } catch {
      clientContacts.value = [] // suggestions facultatives
    }
  }
}
onMounted(load)
watch(() => [props.type, props.id], load)

async function search(event: AutoCompleteCompleteEvent): Promise<void> {
  try {
    const linked = new Set(links.value.map((l) => l.contact.id))
    suggestions.value = (await api.contacts.list({ search: event.query, per_page: 10 })).data.filter((c) => !linked.has(c.id))
  } catch {
    suggestions.value = []
  }
}

async function add(contact: Contact): Promise<void> {
  busy.value = true
  try {
    const link = await api.recordContacts.add(props.type, props.id, contact.id, role.value.trim() || null)
    setLinks([...links.value.filter((l) => l.id !== link.id), link])
    picked.value = null
    role.value = ''
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ajout impossible', detail: apiErrorMessage(e), life: 5000 })
  } finally {
    busy.value = false
  }
}

function onSelect(event: AutoCompleteOptionSelectEvent): void {
  void add(event.value as Contact)
}

function onCreated(contact: Contact): void {
  clientContacts.value = [...clientContacts.value, contact]
  void add(contact)
}

async function saveRole(link: RecordContact, value: string): Promise<void> {
  const next = value.trim() || null
  if (next === link.role) return
  try {
    const updated = await api.recordContacts.setRole(link.id, next)
    setLinks(links.value.map((l) => (l.id === updated.id ? updated : l)))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Rôle non enregistré', detail: apiErrorMessage(e), life: 5000 })
  }
}

async function move(index: number, direction: -1 | 1): Promise<void> {
  try {
    setLinks(await api.recordContacts.order(props.type, props.id, movedIds(links.value, index, direction)))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ordre non enregistré', detail: apiErrorMessage(e), life: 5000 })
  }
}

function remove(link: RecordContact): void {
  confirm.require({
    header: 'Retirer le contact',
    message: `Retirer ${link.contact.full_name} de ce ${props.type === 'quotes' ? 'devis' : 'projet'} ? Le contact lui-même n'est pas supprimé.`,
    acceptProps: { label: 'Retirer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await api.recordContacts.remove(link.id)
        setLinks(links.value.filter((l) => l.id !== link.id))
      } catch (e) {
        toast.add({ severity: 'error', summary: 'Retrait impossible', detail: apiErrorMessage(e), life: 5000 })
      }
    },
  })
}
</script>

<template>
  <div class="record-contacts">
    <div v-if="loading" class="center"><ProgressSpinner style="width: 2rem; height: 2rem" /></div>

    <template v-else>
      <p v-if="!links.length" class="muted">
        Aucun contact lié. {{ editable ? 'Ajoutez les personnes à joindre pour ce dossier : maître d\'ouvrage, architecte, responsable sur place…' : '' }}
      </p>

      <ul v-else class="list">
        <li v-for="(link, index) in links" :key="link.id" class="item">
          <div class="who">
            <RouterLink
              v-if="link.contact.client_id"
              :to="{ name: 'client', params: { id: link.contact.client_id }, query: { onglet: 'contacts' } }"
              class="name"
            >{{ link.contact.full_name }}</RouterLink>
            <span v-else class="name">{{ link.contact.full_name }}</span>
            <span v-if="contactSubtitle(link.contact)" class="muted"> — {{ contactSubtitle(link.contact) }}</span>
            <div class="channels">
              <a v-for="p in contactChannels(link.contact).phones" :key="p" :href="`tel:${p.replace(/\s+/g, '')}`"><i class="pi pi-phone" /> {{ p }}</a>
              <a v-for="m in contactChannels(link.contact).emails" :key="m" :href="`mailto:${m}`"><i class="pi pi-envelope" /> {{ m }}</a>
            </div>
          </div>
          <div class="role">
            <InputText
              v-if="editable"
              :model-value="link.role ?? ''"
              list="record-contact-roles"
              placeholder="Rôle (facultatif)"
              size="small"
              :aria-label="`Rôle de ${link.contact.full_name}`"
              @change="(e: Event) => saveRole(link, (e.target as HTMLInputElement).value)"
            />
            <span v-else-if="link.role" class="role-label">{{ link.role }}</span>
          </div>
          <div v-if="editable" class="actions">
            <Button icon="pi pi-angle-up" text rounded size="small" :disabled="index === 0" aria-label="Monter" @click="move(index, -1)" />
            <Button icon="pi pi-angle-down" text rounded size="small" :disabled="index === links.length - 1" aria-label="Descendre" @click="move(index, 1)" />
            <Button icon="pi pi-times" text rounded size="small" severity="danger" :aria-label="`Retirer ${link.contact.full_name}`" @click="remove(link)" />
          </div>
        </li>
      </ul>

      <div v-if="editable" class="add">
        <div class="add-row">
          <AutoComplete
            v-model="picked"
            :suggestions="suggestions"
            option-label="full_name"
            placeholder="Chercher un contact (nom, société, e-mail…)"
            :delay="250"
            :disabled="busy"
            class="grow"
            @complete="search"
            @option-select="onSelect"
          >
            <template #option="{ option }">
              <div>{{ option.full_name }}</div>
              <small class="muted">{{ contactSubtitle(option) }}</small>
            </template>
          </AutoComplete>
          <InputText v-model="role" list="record-contact-roles" placeholder="Rôle (facultatif)" aria-label="Rôle du contact à ajouter" />
          <Button label="Nouveau contact" icon="pi pi-user-plus" severity="secondary" outlined @click="createOpen = true" />
        </div>
        <div v-if="proposed.length" class="proposed">
          <span class="muted">Contacts du client :</span>
          <Button
            v-for="c in proposed"
            :key="c.id"
            :label="c.full_name"
            icon="pi pi-plus"
            size="small"
            severity="secondary"
            text
            :disabled="busy"
            :title="contactSubtitle(c) || undefined"
            @click="add(c)"
          />
        </div>
      </div>
    </template>

    <datalist id="record-contact-roles">
      <option v-for="r in CONTACT_ROLES" :key="r" :value="r" />
    </datalist>
    <ContactFormDialog v-if="editable" v-model:visible="createOpen" :contact="null" :client-id="props.clientId ?? null" @saved="onCreated" />
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
}
.item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-wrap: wrap;
}
.who {
  flex: 1 1 16rem;
  min-width: 0;
}
.name {
  font-weight: 600;
}
.channels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin-top: 0.25rem;
  font-size: 0.875rem;
}
.role {
  flex: 0 1 14rem;
}
.role-label {
  font-size: 0.875rem;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  background: var(--p-content-hover-background);
}
.actions {
  display: flex;
}
.add-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.grow {
  flex: 1 1 18rem;
}
.proposed {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
}
.center {
  display: flex;
  justify-content: center;
  padding: 1rem;
}
</style>
