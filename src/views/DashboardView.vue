<script setup lang="ts">
import Card from 'primevue/card'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Bonjour {{ auth.user?.firstname }}</h1>
    </div>

    <Card>
      <template #content>
        <p>
          Bienvenue dans Dash4. Les modules (clients, demandes, projets, devis, stock, comptabilité, tâches,
          rapports) arrivent au fil des livraisons de la V1.
        </p>
        <p class="muted">
          Vos profils : {{ auth.user?.roles.map((role) => role.label).join(', ') || '—' }}
        </p>
      </template>
    </Card>
  </div>
</template>
