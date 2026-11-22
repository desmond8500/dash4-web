<script setup lang="ts">
import type { LegendGroup } from '@dash4/shared'
import PlanIconGlyph from '@/components/plans/PlanIconGlyph.vue'

/**
 * Légende du plan telle qu'elle sortira dans les PDF : un tableau par catégorie (icône, libellé, quantité).
 * `unit` = taille en px d'un pixel de l'aperçu à l'échelle de la légende, pour garder les proportions à l'écran.
 */
const props = defineProps<{ groups: LegendGroup[]; unit: number; columns?: number; title?: string; framed?: boolean }>()
</script>

<template>
  <div class="legend-box" :class="{ framed: props.framed }" :style="{ fontSize: `${13.8 * props.unit}px` }">
    <div class="legend-title">LÉGENDE<template v-if="props.title"> — {{ props.title }}</template></div>
    <div class="legend-blocks" :style="{ columnCount: props.columns ?? 1 }">
      <div v-for="group in props.groups" :key="group.category" class="legend-block">
        <div class="legend-head"><span>{{ group.category }}</span><span>Qté</span></div>
        <table>
          <tbody>
            <tr v-for="entry in group.entries" :key="entry.key">
              <td class="ic"><span class="glyph"><PlanIconGlyph :icon="entry.icon" :color="entry.color" /></span></td>
              <td class="name">{{ entry.name }}</td>
              <td class="qty">{{ entry.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Proportions de l'aperçu : ligne 30, en-tête 36, marge 24, icône 22 (en px de l'aperçu, police 13,8) */
.legend-box {
  background: #fff;
  color: #111827;
  padding: 1.74em;
  line-height: 1.2;
  box-sizing: border-box;
  border-top: 0.15em solid #111827;
}
.legend-box.framed {
  border: 0.15em solid #111827;
}
.legend-title {
  font-weight: 700;
  font-size: 1.63em;
  height: 1.78em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.legend-blocks {
  column-gap: 1.74em;
}
.legend-block {
  break-inside: avoid;
  margin-bottom: 0.87em;
}
.legend-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 2.6em;
  font-weight: 700;
  font-size: 1.13em;
  text-transform: uppercase;
  height: 2.3em;
}
table {
  width: 100%;
  border-collapse: collapse;
}
td {
  border: 0.075em solid #111827;
  height: 2.17em;
  padding: 0 0.4em;
  vertical-align: middle;
}
td.ic {
  width: 2.5em;
  text-align: center;
}
td.qty {
  width: 3.5em;
  text-align: center;
}
.glyph {
  display: inline-block;
  width: 1.6em;
  height: 1.6em;
  vertical-align: middle;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 0;
  width: 100%;
}
</style>
