<script setup lang="ts">
import { openFile } from '@/utils/files'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, NOTIFICATION_CATEGORIES, THEMES } from '@dash4/shared'
import type { Cv, NotificationCategory, Theme } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { initials, nextCvName } from '@/utils/cv'
import { formatDate } from '@/utils/projects'
import EmailSignaturesPanel from '@/components/EmailSignaturesPanel.vue'
import { applyTheme } from '@/utils/theme'

const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const errorDetail = (e: unknown) => (e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message)

const form = reactive({ firstname: '', lastname: '', phone: '', job_title: '' })
const saving = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const pwd = reactive({ current_password: '', password: '', password_confirmation: '' })
const pwdSaving = ref(false)
const cvs = ref<Cv[]>([])

function reset(): void {
  const u = auth.user
  if (!u) return
  Object.assign(form, { firstname: u.firstname, lastname: u.lastname, phone: u.phone ?? '', job_title: u.job_title ?? '' })
}

onMounted(async () => {
  reset()
  try {
    cvs.value = await api.cvs.mine()
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: errorDetail(e), life: 5000 })
  }
})

async function save(): Promise<void> {
  saving.value = true
  try {
    auth.user = await api.profile.update({ ...form, phone: form.phone || null, job_title: form.job_title || null })
    toast.add({ severity: 'success', summary: 'Profil enregistré', life: 2500 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Enregistrement impossible', detail: errorDetail(e), life: 6000 })
  } finally {
    saving.value = false
  }
}

async function onAvatar(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    auth.user = await api.profile.uploadAvatar(file, file.name)
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Photo refusée', detail: errorDetail(e), life: 6000 })
  } finally {
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

async function changePassword(): Promise<void> {
  pwdSaving.value = true
  try {
    const message = await api.profile.changePassword({ ...pwd })
    Object.assign(pwd, { current_password: '', password: '', password_confirmation: '' })
    toast.add({ severity: 'success', summary: 'Mot de passe changé', detail: message, life: 4000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Changement impossible', detail: errorDetail(e), life: 6000 })
  } finally {
    pwdSaving.value = false
  }
}

// Préférences : enregistrées dès qu'on les change
async function setTheme(theme: Theme): Promise<void> {
  applyTheme(theme)
  await savePreferences({ theme })
}
async function setNotification(category: NotificationCategory, on: boolean): Promise<void> {
  await savePreferences({ notifications: { [category]: on } })
}
async function savePreferences(preferences: { theme?: Theme; notifications?: Partial<Record<NotificationCategory, boolean>> }): Promise<void> {
  try {
    auth.user = await api.profile.update({ preferences })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Préférence non enregistrée', detail: errorDetail(e), life: 5000 })
  }
}

async function newCv(): Promise<void> {
  const cv = await api.cvs.create({ name: nextCvName(cvs.value) })
  void router.push({ name: 'cv', params: { id: cv.id } })
}
async function duplicate(cv: Cv): Promise<void> {
  cvs.value = [await api.cvs.duplicate(cv.id), ...cvs.value]
}
async function pdf(cv: Cv): Promise<void> {
  openFile(await api.cvs.pdf(cv.id))
}
function remove(cv: Cv): void {
  confirm.require({
    header: 'Supprimer le CV',
    message: `Supprimer « ${cv.name} » ?`,
    acceptProps: { label: 'Supprimer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      await api.cvs.remove(cv.id)
      cvs.value = cvs.value.filter((c) => c.id !== cv.id)
    },
  })
}
</script>

<template>
  <div v-if="auth.user" class="page">
    <div class="page-header">
      <h1>Mon profil</h1>
    </div>

    <Card>
      <template #content>
        <div class="profile">
          <div class="avatar-block">
            <img v-if="auth.user.avatar_url" :src="auth.user.avatar_url" alt="" class="avatar" />
            <div v-else class="avatar avatar-empty">{{ initials(auth.user.firstname, auth.user.lastname) }}</div>
            <Button label="Changer la photo" icon="pi pi-camera" size="small" text @click="avatarInput?.click()" />
            <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onAvatar" />
          </div>
          <form class="form-grid" @submit.prevent="save">
            <label>Prénom <InputText v-model="form.firstname" required /></label>
            <label>Nom <InputText v-model="form.lastname" required /></label>
            <label>Téléphone <InputText v-model="form.phone" /></label>
            <label>Fonction <InputText v-model="form.job_title" /></label>
            <div class="readonly">
              <span class="muted">E-mail :</span> {{ auth.user.email }} ·
              <span class="muted">Compte :</span> {{ auth.user.account_type.label }}
              <Tag v-for="role in auth.user.roles" :key="role.name" :value="role.label" class="role" />
              <p class="muted small">L'e-mail et les profils se changent par un administrateur.</p>
            </div>
            <div class="actions">
              <Button label="Annuler" severity="secondary" text type="button" @click="reset" />
              <Button label="Enregistrer" icon="pi pi-check" type="submit" :loading="saving" />
            </div>
          </form>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Mes CV</template>
      <template #content>
        <p v-if="!cvs.length" class="muted">Aucun CV. Créez-en un : il est prérempli avec votre profil, et vous pouvez y ajouter vos projets Dash4.</p>
        <ul class="cv-list">
          <li v-for="cv in cvs" :key="cv.id">
            <RouterLink :to="{ name: 'cv', params: { id: cv.id } }" class="cv-name">
              <span class="swatch" :style="{ background: cv.accent_color }" />{{ cv.name }}
            </RouterLink>
            <Tag v-if="cv.shared" value="Partagé" severity="info" />
            <span class="muted small">modifié le {{ formatDate(cv.updated_at) }}</span>
            <span class="spacer" />
            <Button icon="pi pi-file-pdf" text rounded title="PDF" aria-label="PDF" @click="pdf(cv)" />
            <Button icon="pi pi-copy" text rounded title="Dupliquer" aria-label="Dupliquer" @click="duplicate(cv)" />
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Supprimer" @click="remove(cv)" />
          </li>
        </ul>
        <Button label="Nouveau CV" icon="pi pi-plus" @click="newCv" />
      </template>
    </Card>

    <Card v-if="auth.user.preferences">
      <template #title>Préférences</template>
      <template #content>
        <div class="prefs">
          <label class="pref-theme">
            Thème
            <Select :model-value="auth.user.preferences.theme" :options="THEMES" option-label="label" option-value="value" @update:model-value="setTheme" />
          </label>
          <div>
            <p class="muted small">Notifications reçues (les alertes de sécurité restent toujours actives) :</p>
            <label v-for="c in NOTIFICATION_CATEGORIES" :key="c.value" class="pref-row">
              <ToggleSwitch :model-value="auth.user.preferences.notifications[c.value]" @update:model-value="setNotification(c.value, $event)" />
              {{ c.label }}
            </label>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Mot de passe</template>
      <template #content>
        <form class="form-grid" @submit.prevent="changePassword">
          <label>Mot de passe actuel <Password v-model="pwd.current_password" :feedback="false" toggle-mask required autocomplete="current-password" /></label>
          <span />
          <label>Nouveau mot de passe <Password v-model="pwd.password" :feedback="false" toggle-mask required autocomplete="new-password" /></label>
          <label>Confirmation <Password v-model="pwd.password_confirmation" :feedback="false" toggle-mask required autocomplete="new-password" /></label>
          <p class="muted small">10 caractères au moins, avec des lettres et des chiffres. Vos autres appareils seront déconnectés.</p>
          <div class="actions">
            <Button label="Changer le mot de passe" icon="pi pi-lock" type="submit" :loading="pwdSaving" />
          </div>
        </form>
      </template>
    </Card>

    <Card>
      <template #title>Signatures d'e-mail</template>
      <template #content>
        <EmailSignaturesPanel />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-empty {
  display: grid;
  place-items: center;
  background: var(--p-primary-100);
  color: var(--p-primary-700);
  font-size: 2rem;
  font-weight: 600;
}
.form-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem 1rem;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.form-grid :deep(.p-password),
.form-grid :deep(.p-password input) {
  width: 100%;
}
.readonly,
.actions,
.form-grid > p {
  grid-column: 1 / -1;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.role {
  margin-left: 0.25rem;
}
.small {
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}
.prefs {
  display: grid;
  gap: 1rem;
}
.pref-theme {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 16rem;
}
.pref-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}
.cv-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
}
.cv-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.cv-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.spacer {
  flex: 1;
}
</style>
