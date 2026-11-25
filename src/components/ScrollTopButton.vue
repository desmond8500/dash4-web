<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Button from 'primevue/button'

/** Bouton flottant « Haut de page », affiché après un défilement suffisant. */
const visible = ref(false)
const threshold = 400

function onScroll(): void {
  visible.value = window.scrollY > threshold
}

function scrollTop(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <Transition name="fade">
    <Button v-if="visible" class="scroll-top" icon="pi pi-arrow-up" rounded aria-label="Haut de page" title="Haut de page" @click="scrollTop" />
  </Transition>
</template>

<style scoped>
.scroll-top {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .scroll-top {
    right: 1rem;
    bottom: 1rem;
  }
}
</style>
