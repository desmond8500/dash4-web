<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError } from '@dash4/shared'
import type { EmailSignature, EmailSignatureList } from '@dash4/shared'
import { api } from '@/services/api'

/** Signatures d'e-mail : les siennes, et celles communes à l'entreprise (administrateur, comptable). */
const toast = useToast()
const confirm = useConfirm()

const list = ref<EmailSignatureList | null>(null)
const open = ref(false)
const edited = ref<EmailSignature | null>(null)
const form = ref({ name: '', body: '', is_default: false, shared: false })
const textarea = ref<{ $el: HTMLTextAreaElement } | null>(null)
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)

const mine = computed(() => list.value?.data.filter((s) => !s.shared) ?? [])
const shared = computed(() => list.value?.data.filter((s) => s.shared) ?? [])

async function load(): Promise<void> {
  try {
    list.value = await api.emailSignatures.list()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  }
}

onMounted(load)

const EXAMPLE = 'Cordialement,\n{nom}\n{fonction} — {entreprise}\n{telephone} · {email}\n{site}'

function openEditor(signature: EmailSignature | null, isShared = false): void {
  edited.value = signature
  errors.value = {}
  form.value = signature
    ? { name: signature.name, body: signature.body, is_default: signature.is_default, shared: signature.shared }
    : { name: isShared ? 'Signature de l\'entreprise' : 'Ma signature', body: EXAMPLE, is_default: !(isShared ? shared.value : mine.value).length, shared: isShared }
  open.value = true
}

/** Insère une variable à l'endroit du curseur. */
function insertVariable(key: string): void {
  const el = textarea.value?.$el
  const body = form.value.body
  if (!el) {
    form.value.body = `${body}${key}`
    return
  }
  const start = el.selectionStart ?? body.length
  const end = el.selectionEnd ?? body.length
  form.value.body = body.slice(0, start) + key + body.slice(end)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(start + key.length, start + key.length)
  })
}

async function save(): Promise<void> {
  saving.value = true
  errors.value = {}
  const { name, body, is_default, shared: isShared } = form.value
  try {
    if (edited.value) await api.emailSignatures.update(edited.value.id, { name: name.trim(), body, is_default })
    else await api.emailSignatures.create({ name: name.trim(), body, is_default, shared: isShared })
    open.value = false
    toast.add({ severity: 'success', summary: 'Signature enregistrée', life: 2500 })
    await load()
  } catch (e) {
    if (e instanceof ApiError) errors.value = e.errors
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: (e as Error).message, life: 5000 })
  } finally {
    saving.value = false
  }
}

async function makeDefault(signature: EmailSignature): Promise<void> {
  await api.emailSignatures.update(signature.id, { is_default: true })
  await load()
}

function remove(signature: EmailSignature): void {
  confirm.require({
    header: 'Supprimer la signature',
    message: `Supprimer « ${signature.name} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.emailSignatures.remove(signature.id)
      await load()
    },
  })
}
</script>

<template>
  <div v-if="list" class="panel">
    <div class="toolbar">
      <span class="muted">Ajoutée sous vos messages, par exemple à l'envoi d'un devis. Les variables se remplissent avec vos informations.</span>
      <div class="actions">
        <Button v-if="list.meta.can_manage_shared" label="Signature de l'entreprise" icon="pi pi-building" size="small" severity="secondary" outlined @click="openEditor(null, true)" />
        <Button label="Nouvelle signature" icon="pi pi-plus" size="small" @click="openEditor(null)" />
      </div>
    </div>

    <div v-for="group in [{ title: 'Mes signatures', items: mine }, { title: 'Signatures de l\'entreprise', items: shared }]" :key="group.title">
      <h3 v-if="group.items.length || group.title === 'Mes signatures'">{{ group.title }}</h3>
      <p v-if="!group.items.length && group.title === 'Mes signatures'" class="muted">
        Aucune signature personnelle<template v-if="shared.length"> : celle de l'entreprise est utilisée par défaut</template>.
      </p>
      <div class="cards">
        <article v-for="s in group.items" :key="s.id" class="sig" :class="{ default: s.id === list.meta.default_id }">
          <header>
            <strong>{{ s.name }}</strong>
            <Tag v-if="s.is_default" value="Par défaut" severity="success" />
          </header>
          <pre class="preview">{{ s.preview }}</pre>
          <footer v-if="s.can_edit">
            <Button v-if="!s.is_default" label="Par défaut" size="small" text @click="makeDefault(s)" />
            <Button icon="pi pi-pencil" size="small" text rounded aria-label="Modifier" @click="openEditor(s)" />
            <Button icon="pi pi-trash" size="small" text rounded severity="danger" aria-label="Supprimer" @click="remove(s)" />
          </footer>
        </article>
      </div>
    </div>

    <Dialog v-model:visible="open" :header="edited ? 'Modifier la signature' : form.shared ? 'Signature de l\'entreprise' : 'Nouvelle signature'" modal :style="{ width: '600px' }" :breakpoints="{ '650px': '95vw' }">
      <div class="form-grid">
        <div class="form-field form-field--full">
          <label for="sig-name">Nom</label>
          <InputText id="sig-name" v-model="form.name" placeholder="Ex. : Complète, Courte, Anglais…" :invalid="!!errors.name" />
        </div>
        <div class="form-field form-field--full">
          <label for="sig-body">Texte</label>
          <Textarea id="sig-body" ref="textarea" v-model="form.body" rows="7" auto-resize :invalid="!!errors.body" />
          <small v-if="errors.body" class="field-error">{{ errors.body[0] }}</small>
          <div class="variables">
            <span class="muted small">Insérer :</span>
            <Button
              v-for="v in list.meta.variables"
              :key="v.key"
              :label="v.key"
              :title="v.label"
              size="small"
              severity="secondary"
              text
              @click="insertVariable(v.key)"
            />
          </div>
          <small class="muted">Une ligne dont la variable est vide (pas de fonction, pas de téléphone…) est retirée à l'envoi.</small>
        </div>
        <label class="form-field--full check">
          <Checkbox v-model="form.is_default" binary />
          {{ form.shared ? 'Signature par défaut de l\'entreprise (pour ceux qui n\'ont pas la leur)' : 'Ma signature par défaut' }}
        </label>
      </div>
      <template #footer>
        <Button label="Annuler" severity="secondary" text @click="open = false" />
        <Button label="Enregistrer" icon="pi pi-check" :loading="saving" :disabled="!form.name.trim() || !form.body.trim()" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

h3 {
  font-size: 1rem;
  margin: 0.5rem 0;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}

.sig {
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sig.default {
  border-color: var(--p-primary-color);
}

.sig header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sig footer {
  display: flex;
  justify-content: flex-end;
}

.preview {
  margin: 0;
  font-family: inherit;
  font-size: 0.875rem;
  white-space: pre-wrap;
  color: var(--p-text-muted-color);
}

.variables {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.125rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
