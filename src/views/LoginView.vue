<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  error.value = null
  loading.value = true
  try {
    await auth.login(form)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch (e) {
    error.value =
      e instanceof ApiError ? (e.fieldError('email') ?? e.message) : 'Connexion impossible. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <form class="card" @submit.prevent="submit">
      <h1>Dash4</h1>
      <p class="muted">Connectez-vous pour continuer.</p>

      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <div class="form-field">
        <label for="email">Adresse e-mail</label>
        <InputText id="email" v-model="form.email" type="email" autocomplete="username" required autofocus />
      </div>

      <div class="form-field">
        <label for="password">Mot de passe</label>
        <Password
          v-model="form.password"
          input-id="password"
          :feedback="false"
          toggle-mask
          fluid
          autocomplete="current-password"
          required
        />
      </div>

      <Button type="submit" label="Se connecter" icon="pi pi-sign-in" :loading="loading" fluid />

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
</style>
