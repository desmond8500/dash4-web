<script setup lang="ts">
import Button from 'primevue/button'
</script>

<template>
  <div class="page status">
    <i class="pi pi-compass" />
    <h1>Page introuvable</h1>
    <p class="muted">Cette adresse n'existe pas ou plus.</p>
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
