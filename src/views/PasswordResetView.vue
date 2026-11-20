<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError } from '@dash4/shared'
import { api } from '@/services/api'

/** « Mot de passe oublié » (demande du lien) et « Nouveau mot de passe » (lien reçu par e-mail). */
const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const resetting = computed(() => route.name === 'password-reset' && token.value !== '')

const form = reactive({
  email: typeof route.query.email === 'string' ? route.query.email : '',
  password: '',
  password_confirmation: '',
})
const loading = ref(false)
const error = ref<string | null>(null)
const done = ref<string | null>(null)

async function submit(): Promise<void> {
  error.value = null
  loading.value = true
  try {
    done.value = resetting.value
      ? await api.auth.resetPassword({ token: token.value, ...form })
      : await api.auth.forgotPassword(form.email)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Impossible pour le moment. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="submit">
      <h1>Dash4</h1>
      <p v-if="resetting">Choisissez votre nouveau mot de passe.</p>
      <p v-else>Indiquez l'adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</p>

      <Message v-if="done" severity="success" :closable="false">{{ done }}</Message>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <template v-if="!done">
        <div class="form-field">
          <label for="email">Adresse e-mail</label>
          <InputText id="email" v-model="form.email" type="email" autocomplete="username" required :disabled="resetting" />
        </div>
        <template v-if="resetting">
          <div class="form-field">
            <label for="password">Nouveau mot de passe</label>
            <Password v-model="form.password" input-id="password" :feedback="false" toggle-mask fluid required autocomplete="new-password" />
            <small class="muted">10 caractères au moins, avec des lettres et des chiffres.</small>
          </div>
          <div class="form-field">
            <label for="confirmation">Confirmation</label>
            <Password v-model="form.password_confirmation" input-id="confirmation" :feedback="false" toggle-mask fluid required autocomplete="new-password" />
          </div>
        </template>
        <Button type="submit" :label="resetting ? 'Changer le mot de passe' : 'Recevoir le lien'" :loading="loading" fluid />
      </template>
      <p v-else-if="resetting" class="muted">Techniciens : connectez-vous dans l'application mobile avec ce nouveau mot de passe.</p>

      <RouterLink :to="{ name: 'login' }" class="back">Retour à la connexion</RouterLink>
    </form>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1rem;
}
.card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  border-radius: 12px;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}
h1 {
  margin: 0;
  color: var(--p-primary-color);
}
p {
  margin: 0;
}
.back {
  text-align: center;
  font-size: 0.9rem;
}
</style>
