<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import { useAuthStore } from '@/stores/auth'
import { useClientRequestsStore } from '@/stores/clientRequests'

const auth = useAuthStore()
const requests = useClientRequestsStore()
const router = useRouter()

const canSeeRequests = computed(() => auth.canAny(['client_requests.view', 'client_requests.view.own']))

const tiles = computed(() => {
  const s = requests.summary
  if (!s) return []
  return [
    { label: 'À traiter', value: s.open, tone: 'primary' },
    { label: 'En retard', value: s.overdue, tone: s.overdue ? 'danger' : 'muted', hint: `Nouvelles depuis plus de ${s.overdue_days} j` },
    { label: 'Confiées à moi', value: s.mine, tone: 'muted' },
    { label: 'Rappels arrivés', value: s.reminders_due, tone: s.reminders_due ? 'warn' : 'muted' },
  ]
})

onMounted(() => void requests.refreshSummary())
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Bonjour {{ auth.user?.firstname }}</h1>
    </div>

    <Card v-if="canSeeRequests">
      <template #title>
        <div class="card-title">
          <span>Demandes clients</span>
          <div class="actions">
            <Button
              v-if="auth.can('client_requests.create')"
              label="Noter une demande"
              icon="pi pi-plus"
              size="small"
              @click="requests.openQuick()"
            />
            <Button label="Ouvrir la boîte" size="small" text @click="router.push({ name: 'client-requests' })" />
          </div>
        </div>
      </template>
      <template #content>
        <div class="tiles">
          <div v-for="tile in tiles" :key="tile.label" class="tile" :class="`tone-${tile.tone}`">
            <span class="value">{{ tile.value }}</span>
            <span class="label">{{ tile.label }}</span>
            <span v-if="tile.hint" class="muted hint">{{ tile.hint }}</span>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #content>
        <p>
          Bienvenue dans Dash4. Clients, contacts et demandes clients sont disponibles ; projets, devis, stock,
          comptabilité, tâches et rapports arrivent au fil des livraisons de la V1.
        </p>
        <p class="muted">
          Vos profils : {{ auth.user?.roles.map((role) => role.label).join(', ') || '—' }}
        </p>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.tile {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-radius: 10px;
  background: var(--p-content-hover-background);
}

.value {
  font-size: 1.75rem;
  font-weight: 700;
}

.label {
  font-weight: 500;
}

.hint {
  font-size: 0.8rem;
}

.tone-primary .value {
  color: var(--p-primary-color);
}

.tone-danger .value {
  color: var(--p-red-500);
}

.tone-warn .value {
  color: var(--p-orange-500);
}
</style>
