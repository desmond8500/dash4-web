<script setup lang="ts">
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="technician">
    <div class="card">
      <i class="pi pi-mobile" />
      <h1>Utilisez l'application mobile</h1>
      <p class="muted">
        Bonjour {{ auth.user?.firstname }}, votre compte technicien donne accès à l'application mobile Dash4 :
        tâches, rapports d'intervention, informations du chantier. Le site web est réservé aux gestionnaires.
      </p>
      <Button label="Se déconnecter" icon="pi pi-sign-out" severity="secondary" @click="logout" />
    </div>
  </div>
</template>

<style scoped>
.technician {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.card {
  max-width: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  border-radius: 12px;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
}

.card i {
  font-size: 2.5rem;
  color: var(--p-primary-color);
}

h1 {
  margin: 0;
  font-size: 1.375rem;
}

p {
  margin: 0;
}
</style>
