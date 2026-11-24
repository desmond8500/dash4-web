<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { qrSvg, toolQrContent } from '@dash4/shared'
import type { Tool } from '@dash4/shared'
import { isSingleLabel, LABEL_FORMATS, printToolLabels, toolLabelsHtml, type LabelFormat } from '@/utils/toolLabels'

/**
 * Étiquettes QR des outils choisis : format de planche, étiquettes déjà utilisées à sauter, aperçu, impression
 * (ou « Enregistrer en PDF » pour imprimer plus tard). Le QR code mène à la fiche de l'outil ; l'application mobile le lit.
 */
const props = defineProps<{ tools: Array<Pick<Tool, 'id' | 'name' | 'code'>> }>()
const visible = defineModel<boolean>('visible', { required: true })

const FORMAT_KEY = 'dash4.tools.labelFormat'
const format = ref<LabelFormat>('a4-24')
const skip = ref<number | null>(0)
const blocked = ref(false)
const info = computed(() => LABEL_FORMATS.find((f) => f.value === format.value)!)
const pages = computed(() => Math.max(1, Math.ceil((props.tools.length + (isSingleLabel(format.value) ? 0 : skip.value ?? 0)) / info.value.perPage)))
const sample = computed(() =>
  props.tools[0]
    ? info.value.shortCode
      ? qrSvg(toolQrContent(props.tools[0].id), { margin: 1, errorLevel: 'L' })
      : qrSvg(toolQrContent(props.tools[0].id, window.location.origin), { margin: 1 })
    : '',
)
const tape = computed(() => format.value.startsWith('tape-'))

watch(visible, (open) => {
  if (!open) return
  blocked.value = false
  skip.value = 0
  try {
    const saved = localStorage.getItem(FORMAT_KEY) as LabelFormat | null
    if (saved && LABEL_FORMATS.some((f) => f.value === saved)) format.value = saved
  } catch {
    // réglage non gardé
  }
})

function print(): void {
  try {
    localStorage.setItem(FORMAT_KEY, format.value)
  } catch {
    // réglage non gardé
  }
  const html = toolLabelsHtml(props.tools, { format: format.value, origin: window.location.origin, skip: skip.value ?? 0 })
  blocked.value = !printToolLabels(html)
  if (!blocked.value) visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" header="Étiquettes QR" modal :style="{ width: '520px' }" :breakpoints="{ '560px': '96vw' }">
    <div class="form-grid">
      <p class="form-field--full">
        {{ props.tools.length }} outil{{ props.tools.length > 1 ? 's' : '' }} · {{ pages }} page{{ pages > 1 ? 's' : '' }}.
        Le QR code ouvre la fiche de l'outil ; l'application mobile le lit pour prêter ou rendre l'outil.
      </p>
      <div class="form-field form-field--full">
        <label for="lb-format">Format</label>
        <Select id="lb-format" v-model="format" :options="LABEL_FORMATS" option-label="label" option-value="value" />
      </div>
      <p v-if="tape" class="form-field--full muted small">
        Dans la fenêtre d'impression, choisissez l'étiqueteuse et le ruban de la même largeur, marges « Aucune », échelle 100 %.
        <template v-if="info.shortCode">Sur ce ruban étroit, le QR code contient seulement le numéro de l'outil : il se lit avec l'application mobile Dash4.</template>
      </p>
      <div v-if="!isSingleLabel(format)" class="form-field form-field--full">
        <label for="lb-skip">Étiquettes déjà utilisées sur la planche</label>
        <InputNumber v-model="skip" input-id="lb-skip" :min="0" :max="info.perPage - 1" show-buttons />
        <small class="muted">Les premières étiquettes restent vides, pour finir une planche entamée.</small>
      </div>
      <div v-if="props.tools[0]" class="form-field--full preview">
        <!-- eslint-disable-next-line vue/no-v-html -- SVG produit par qrSvg, sans texte saisi -->
        <div class="qr" v-html="sample" />
        <div>
          <strong>{{ props.tools[0].name }}</strong>
          <div v-if="props.tools[0].code" class="mono">{{ props.tools[0].code }}</div>
        </div>
      </div>
      <Message v-if="blocked" class="form-field--full" severity="warn" :closable="false">
        Le navigateur a bloqué le nouvel onglet : autorisez les fenêtres pour ce site, puis recommencez.
      </Message>
      <p class="form-field--full muted small">Pour imprimer plus tard, choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.</p>
    </div>
    <template #footer>
      <Button label="Annuler" text severity="secondary" @click="visible = false" />
      <Button label="Imprimer" icon="pi pi-print" :disabled="!props.tools.length" @click="print" />
    </template>
  </Dialog>
</template>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px dashed var(--p-content-border-color);
  border-radius: 6px;
  background: #fff;
  color: #000;
}
.qr {
  width: 96px;
  height: 96px;
  flex: none;
}
.qr :deep(svg) {
  width: 100%;
  height: 100%;
}
.mono {
  font-family: 'Courier New', monospace;
  font-weight: 700;
}
.small {
  font-size: 0.85rem;
}
</style>
