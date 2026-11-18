<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import { useAuthStore } from '@/stores/auth'
import EmailSignaturesPanel from '@/components/EmailSignaturesPanel.vue'

const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.user" class="page">
    <div class="page-header">
      <h1>Mon profil</h1>
    </div>

    <Card>
      <template #content>
        <dl class="details">
          <dt>Nom</dt>
          <dd>{{ auth.user.full_name }}</dd>
          <dt>E-mail</dt>
          <dd>{{ auth.user.email }}</dd>
          <dt>Téléphone</dt>
          <dd>{{ auth.user.phone || '—' }}</dd>
          <dt>Fonction</dt>
          <dd>{{ auth.user.job_title || '—' }}</dd>
          <dt>Type de compte</dt>
          <dd>{{ auth.user.account_type.label }}</dd>
          <dt>Profils</dt>
          <dd class="tags">
            <Tag v-for="role in auth.user.roles" :key="role.name" :value="role.label" />
          </dd>
        </dl>
        <p class="muted">La modification du profil et le CV arriveront avec l'espace personnel (V1.1).</p>
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
.details {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 0.75rem 1rem;
  margin: 0 0 1rem;
}

dt {
  color: var(--p-text-muted-color);
}

dd {
  margin: 0;
}

.tags {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}
</style>
