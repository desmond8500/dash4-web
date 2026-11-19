<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import { ApiError, BADGE_FIELDS } from '@dash4/shared'
import type { BadgeTemplate, BadgeTemplatePayload } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/** Modèles de badge : couleurs, textes, champs imprimés, logo et image de fond. */
const props = defineProps<{ clientId: number | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ changed: [templates: BadgeTemplate[]] }>()
const auth = useAuthStore()

const templates = ref<BadgeTemplate[]>([])
const current = ref<BadgeTemplate | null>(null)
const form = ref<BadgeTemplatePayload & { name: string }>({ name: '' })
const error = ref<string | null>(null)
const saving = ref(false)

async function load(): Promise<void> {
  templates.value = await api.badges.templates(props.clientId ?? undefined).catch(() => [])
  emit('changed', templates.value)
}
watch(visible, (open) => open && void load().then(() => edit(templates.value[0] ?? null)))

function edit(t: BadgeTemplate | null): void {
  current.value = t
  error.value = null
  form.value = t
    ? { name: t.name, client_id: t.client_id, orientation: t.orientation, primary_color: t.primary_color, text_color: t.text_color, title: t.title, subtitle: t.subtitle, fields: [...t.fields], footer: t.footer }
    : { name: 'Nouveau modèle', client_id: props.clientId, orientation: 'landscape', primary_color: '#1d4ed8', text_color: '#111827', title: null, subtitle: null, fields: ['job_title', 'department'], footer: null }
}

async function save(): Promise<void> {
  if (!form.value.name.trim()) return void (error.value = 'Donnez un nom au modèle.')
  saving.value = true
  try {
    const saved = current.value ? await api.badges.updateTemplate(current.value.id, form.value) : await api.badges.createTemplate(form.value)
    await load()
    edit(templates.value.find((t) => t.id === saved.id) ?? saved)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  } finally {
    saving.value = false
  }
}

async function onImage(kind: 'logo' | 'background', event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !current.value) return
  try {
    const t = await api.badges.uploadTemplateImage(current.value.id, kind, file, file.name)
    await load()
    current.value = t
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message
  }
}
async function removeImage(kind: 'logo' | 'background'): Promise<void> {
  if (!current.value) return
  current.value = await api.badges.removeTemplateImage(current.value.id, kind)
  await load()
}
async function remove(): Promise<void> {
  if (!current.value) return
  await api.badges.removeTemplate(current.value.id)
  await load()
  edit(templates.value[0] ?? null)
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Modèles de badge" modal :style="{ width: '860px' }" :breakpoints="{ '900px': '96vw' }">
    <div class="layout">
      <aside class="list">
        <button v-for="t in templates" :key="t.id" type="button" class="item" :class="{ active: current?.id === t.id }" @click="edit(t)">
          <span class="swatch" :style="{ background: t.primary_color }" />{{ t.name }}<small v-if="t.client" class="muted"> · {{ t.client.name }}</small>
        </button>
        <Button v-if="auth.can('badges.create')" label="Nouveau modèle" icon="pi pi-plus" text size="small" @click="edit(null)" />
      </aside>
      <form id="tpl-form" class="form-grid" @submit.prevent="save">
        <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>
        <div class="form-field"><label for="tpl-name">Nom</label><InputText id="tpl-name" v-model="form.name" /></div>
        <div class="form-field">
          <label for="tpl-or">Format</label>
          <Select id="tpl-or" v-model="form.orientation" :options="[{ v: 'landscape', l: 'Paysage' }, { v: 'portrait', l: 'Portrait' }]" option-label="l" option-value="v" />
        </div>
        <div class="form-field"><label for="tpl-title">Titre (bandeau)</label><InputText id="tpl-title" v-model="form.title" placeholder="Nom de l'organisation" /></div>
        <div class="form-field"><label for="tpl-sub">Sous-titre</label><InputText id="tpl-sub" v-model="form.subtitle" /></div>
        <div class="form-field"><label for="tpl-c1">Couleur du bandeau</label><input id="tpl-c1" v-model="form.primary_color" type="color" class="color" /></div>
        <div class="form-field"><label for="tpl-c2">Couleur du texte</label><input id="tpl-c2" v-model="form.text_color" type="color" class="color" /></div>
        <div class="form-field form-field--full">
          <label>Champs imprimés</label>
          <div class="checks">
            <label v-for="f in BADGE_FIELDS" :key="f.value" class="check"><Checkbox v-model="form.fields" :value="f.value" /> {{ f.label }}</label>
          </div>
        </div>
        <div class="form-field form-field--full"><label for="tpl-foot">Pied (bas de carte)</label><InputText id="tpl-foot" v-model="form.footer" placeholder="Badge à porter visiblement" /></div>
        <div v-if="current" class="form-field form-field--full images">
          <div v-for="kind in (['logo', 'background'] as const)" :key="kind" class="image">
            <span class="muted small">{{ kind === 'logo' ? 'Logo' : 'Image de fond' }}</span>
            <img v-if="kind === 'logo' ? current.logo_url : current.background_url" :src="(kind === 'logo' ? current.logo_url : current.background_url)!" alt="" />
            <label class="link small">Choisir<input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onImage(kind, $event)" /></label>
            <Button v-if="kind === 'logo' ? current.logo_url : current.background_url" icon="pi pi-times" text rounded size="small" aria-label="Retirer" @click="removeImage(kind)" />
          </div>
        </div>
        <p v-else class="form-field--full muted small">Le logo et le fond s'ajoutent une fois le modèle enregistré.</p>
        <!-- Aperçu -->
        <div class="form-field form-field--full">
          <div class="preview" :class="form.orientation" :style="{ color: form.text_color, backgroundImage: current?.background_url ? `url(${current.background_url})` : undefined }">
            <div class="band" :style="{ background: form.primary_color }">
              <strong>{{ form.title || 'Titre' }}</strong><small>{{ form.subtitle }}</small>
              <img v-if="current?.logo_url" :src="current.logo_url" alt="" />
            </div>
            <div class="photo"><i class="pi pi-user" /></div>
            <div class="info"><strong>Prénom NOM</strong><div v-for="f in BADGE_FIELDS.filter((x) => form.fields?.includes(x.value))" :key="f.value" class="small">{{ f.label }}</div></div>
            <div v-if="form.footer" class="foot" :style="{ background: form.primary_color }">{{ form.footer }}</div>
          </div>
        </div>
      </form>
    </div>
    <template #footer>
      <Button v-if="current && auth.can('badges.delete')" label="Supprimer" icon="pi pi-trash" text severity="danger" @click="remove" />
      <Button label="Fermer" text severity="secondary" @click="visible = false" />
      <Button label="Enregistrer" icon="pi pi-check" type="submit" form="tpl-form" :loading="saving" :disabled="current ? !auth.can('badges.update') : !auth.can('badges.create')" />
    </template>
  </Dialog>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 1rem;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item.active {
  background: var(--p-content-hover-background);
  border-color: var(--p-content-border-color);
}

.swatch {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 3px;
}

.color {
  width: 3rem;
  height: 2.25rem;
  border: 0;
  background: none;
}

.checks,
.images {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.check,
.image {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.image img {
  max-height: 32px;
  max-width: 80px;
}

.preview {
  position: relative;
  width: 342px;
  height: 216px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  overflow: hidden;
  background: #fff center / cover no-repeat;
}

.preview.portrait {
  width: 216px;
  height: 342px;
}

.band {
  position: absolute;
  inset: 0 0 auto;
  height: 44px;
  color: #fff;
  padding: 4px 10px;
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
}

.band img {
  position: absolute;
  right: 8px;
  top: 6px;
  max-height: 32px;
  max-width: 80px;
}

.photo {
  position: absolute;
  left: 12px;
  top: 56px;
  width: 88px;
  height: 112px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 2rem;
}

.info {
  position: absolute;
  left: 112px;
  top: 56px;
  right: 10px;
}

.portrait .photo {
  left: 64px;
}

.portrait .info {
  left: 10px;
  top: 180px;
  text-align: center;
}

.foot {
  position: absolute;
  inset: auto 0 0;
  height: 20px;
  color: #fff;
  font-size: 0.7rem;
  text-align: center;
  line-height: 20px;
}

.small {
  font-size: 0.8rem;
}

.link {
  color: var(--p-primary-color);
  cursor: pointer;
}
</style>
