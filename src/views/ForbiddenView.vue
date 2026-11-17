<script setup lang="ts">
import Button from 'primevue/button'
</script>

<template>
  <div class="page status">
    <i class="pi pi-lock" />
    <h1>Accès refusé</h1>
    <p class="muted">Votre profil ne permet pas d'ouvrir cette page.</p>
    <RouterLink to="/"><Button label="Retour à l'accueil" icon="pi pi-home" /></RouterLink>
  </div>
</template>

<style scoped>
.status {
  align-items: center;
  text-align: center;
  padding-top: 4rem;
}

.status i {
  font-size: 2.5rem;
  color: var(--p-text-muted-color);
}

h1 {
  margin: 0;
}
</style>
