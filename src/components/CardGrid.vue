<script setup lang="ts" generic="T extends { id: number | string }">
import Paginator, { type PageState } from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import type { DataTablePageEvent } from 'primevue/datatable'

/**
 * Liste affichée en cartes, avec la même pagination que les tableaux (serveur avec `lazy`, sinon tout s'affiche).
 * Une carte s'ouvre au clic ou avec Entrée ; les boutons dans une carte arrêtent le clic (`@click.stop`).
 */
const props = withDefaults(
  defineProps<{
    items: T[]
    loading?: boolean
    lazy?: boolean
    total?: number
    rows?: number
    rowsPerPageOptions?: number[]
    emptyText?: string
    clickable?: boolean
    /** Largeur minimale d'une carte. */
    minWidth?: string
    /** Classe ajoutée à chaque carte (ex. `contact-badge`). */
    cardClass?: string
  }>(),
  { rows: 25, rowsPerPageOptions: () => [25, 50, 100], emptyText: 'Aucun élément.', clickable: true, minWidth: '17rem' },
)
const emit = defineEmits<{ open: [item: T]; page: [event: DataTablePageEvent] }>()

const first = defineModel<number>('first', { default: 0 })

function onPage(state: PageState): void {
  first.value = state.first
  emit('page', { ...state, sortField: undefined, sortOrder: undefined, multiSortMeta: [], filters: {} } as unknown as DataTablePageEvent)
}
</script>

<template>
  <div class="card-grid-wrap">
    <div v-if="props.loading && !props.items.length" class="card-grid-loading"><ProgressSpinner style="width: 2.5rem; height: 2.5rem" /></div>
    <p v-else-if="!props.items.length" class="muted card-grid-empty">{{ props.emptyText }}</p>
    <div v-else class="card-grid" :class="{ dim: props.loading }" :style="{ '--card-min': props.minWidth }">
      <article
        v-for="item in props.items"
        :key="item.id"
        class="entity-card"
        :class="[props.cardClass, { clickable: props.clickable }]"
        :tabindex="props.clickable ? 0 : undefined"
        :role="props.clickable ? 'link' : undefined"
        @click="props.clickable && emit('open', item)"
        @keydown.enter.self="props.clickable && emit('open', item)"
      >
        <slot name="card" :item="item" />
      </article>
    </div>
    <Paginator
      v-if="props.lazy && (props.total ?? 0) > props.rows"
      :first="first"
      :rows="props.rows"
      :total-records="props.total"
      :rows-per-page-options="props.rowsPerPageOptions"
      @page="onPage"
    />
  </div>
</template>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  gap: 0.875rem;
  transition: opacity 0.15s;
}
.card-grid.dim {
  opacity: 0.55;
}
.card-grid-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}
.card-grid-empty {
  padding: 1rem 0;
}
</style>
