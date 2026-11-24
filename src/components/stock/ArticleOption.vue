<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Article } from '@dash4/shared'
import { formatQty } from '@/utils/stock'

/**
 * Une ligne de résultat de recherche d'article : photo (ou icône), désignation, référence, marque
 * et quantité en stock, pour reconnaître l'article d'un coup d'œil.
 */
const props = withDefaults(defineProps<{ article: Article; showStock?: boolean }>(), { showStock: true })
const broken = ref(false)
watch(() => props.article.image_url, () => (broken.value = false))
</script>

<template>
  <div class="article-option">
    <span class="thumb" aria-hidden="true">
      <img v-if="props.article.image_url && !broken" :src="props.article.image_url" alt="" loading="lazy" @error="broken = true" />
      <i v-else class="pi pi-box" />
    </span>
    <span class="text">
      <span class="designation">{{ props.article.designation }}</span>
      <span v-if="props.article.reference || props.article.brand" class="muted small">
        {{ [props.article.reference, props.article.brand?.name].filter(Boolean).join(' · ') }}
      </span>
    </span>
    <span v-if="props.showStock" class="stock" :class="{ low: props.article.is_low || props.article.quantity <= 0 }">
      {{ formatQty(props.article.quantity) }} {{ props.article.unit ?? '' }}
    </span>
  </div>
</template>

<style scoped>
.article-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
}
.thumb {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  background: #fff;
  color: var(--p-text-muted-color);
  overflow: hidden;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.designation {
  white-space: normal;
}
.small {
  font-size: 0.8rem;
}
.stock {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.stock.low {
  color: var(--p-red-500);
  font-weight: 600;
}
</style>
