<script setup lang="ts">
import type { StockMovement } from '@dash4/shared'
import { formatDateTime } from '@/utils/clientRequests'
import { signedQty, formatQty } from '@/utils/stock'

/** Journal de mouvements (fiche article ou journal général). */
const props = defineProps<{ movements: StockMovement[]; showArticle?: boolean }>()
</script>

<template>
  <table v-if="props.movements.length" class="list">
    <thead>
      <tr>
        <th>Date</th>
        <th v-if="props.showArticle">Article</th>
        <th>Mouvement</th>
        <th>Motif</th>
        <th class="num">Quantité</th>
        <th class="num">Stock après</th>
        <th>Par</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="m in props.movements" :key="m.id">
        <td>{{ formatDateTime(m.moved_at) }}</td>
        <td v-if="props.showArticle">
          <RouterLink v-if="m.article" :to="{ name: 'article', params: { id: m.article.id } }">{{ m.article.designation }}</RouterLink>
        </td>
        <td>{{ m.type.label }}</td>
        <td>
          <RouterLink v-if="m.source?.type === 'delivery_note' && m.source.quote_id" :to="{ name: 'quote', params: { id: m.source.quote_id } }">{{ m.reason }}</RouterLink>
          <RouterLink v-else-if="m.source?.type === 'purchase'" :to="{ name: 'purchase', params: { id: m.source.id } }">{{ m.reason }}</RouterLink>
          <template v-else>{{ m.reason ?? '' }}</template>
          <div v-if="m.project" class="muted small">Projet : {{ m.project.name }}</div>
        </td>
        <td class="num" :class="m.quantity < 0 ? 'out' : 'in'">{{ signedQty(m.quantity) }}</td>
        <td class="num">{{ formatQty(m.quantity_after) }}</td>
        <td>{{ m.creator?.full_name ?? '—' }}</td>
      </tr>
    </tbody>
  </table>
  <p v-else class="muted">Aucun mouvement.</p>
</template>

<style scoped>
.in {
  color: var(--p-green-600);
  font-weight: 600;
}

.out {
  color: var(--p-red-500);
  font-weight: 600;
}

.small {
  font-size: 0.8rem;
}
</style>
