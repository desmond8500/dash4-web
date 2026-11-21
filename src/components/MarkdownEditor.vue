<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import Textarea from 'primevue/textarea'
import { applyMarkdown, type MarkdownAction } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'

/**
 * Zone de texte avec mise en forme Markdown : barre d'outils (gras, italique, titre, listes, case à cocher,
 * citation, lien) et aperçu. Les attributs (id, rows, placeholder, fluid…) vont à la zone de texte.
 */
defineOptions({ inheritAttrs: false })
const model = defineModel<string | null | undefined>()
const props = withDefaults(defineProps<{ disabled?: boolean; autoResize?: boolean }>(), { disabled: false, autoResize: true })

const area = ref<InstanceType<typeof Textarea> | null>(null)
const preview = ref(false)
const empty = computed(() => !(model.value ?? '').trim())

const tools: { action: MarkdownAction; icon?: string; text?: string; title: string }[] = [
  { action: 'bold', text: 'G', title: 'Gras (Ctrl+B)' },
  { action: 'italic', text: 'I', title: 'Italique (Ctrl+I)' },
  { action: 'heading', icon: 'pi pi-hashtag', title: 'Titre' },
  { action: 'ul', icon: 'pi pi-list', title: 'Liste à puces' },
  { action: 'ol', text: '1.', title: 'Liste numérotée' },
  { action: 'task', icon: 'pi pi-check-square', title: 'Liste de cases à cocher' },
  { action: 'quote', icon: 'pi pi-comment', title: 'Citation' },
  { action: 'link', icon: 'pi pi-link', title: 'Lien' },
]

function element(): HTMLTextAreaElement | null {
  return (area.value?.$el as HTMLTextAreaElement | undefined) ?? null
}

async function apply(action: MarkdownAction): Promise<void> {
  const el = element()
  const text = model.value ?? ''
  const result = applyMarkdown(text, el?.selectionStart ?? text.length, el?.selectionEnd ?? text.length, action)
  model.value = result.text
  await nextTick()
  el?.focus()
  el?.setSelectionRange(result.start, result.end)
}

function onKeydown(e: KeyboardEvent): void {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return
  const key = e.key.toLowerCase()
  if (key === 'b' || key === 'i') {
    e.preventDefault()
    void apply(key === 'b' ? 'bold' : 'italic')
  }
}
</script>

<template>
  <div class="md-editor" :class="{ disabled: props.disabled }">
    <div v-if="!props.disabled" class="md-toolbar" role="toolbar" aria-label="Mise en forme">
      <template v-if="!preview">
        <button v-for="t in tools" :key="t.action" type="button" class="md-tool" :title="t.title" :aria-label="t.title" @mousedown.prevent @click="apply(t.action)">
          <i v-if="t.icon" :class="t.icon" />
          <span v-else :class="{ b: t.action === 'bold', i: t.action === 'italic' }">{{ t.text }}</span>
        </button>
      </template>
      <span class="md-spacer" />
      <button type="button" class="md-tool md-preview-toggle" :aria-pressed="preview" @click="preview = !preview">
        {{ preview ? 'Modifier' : 'Aperçu' }}
      </button>
    </div>
    <div v-if="preview" class="md-preview">
      <MarkdownView v-if="!empty" :text="model" />
      <span v-else class="muted">Rien à afficher.</span>
    </div>
    <Textarea
      v-show="!preview"
      ref="area"
      v-model="model"
      v-bind="$attrs"
      :disabled="props.disabled"
      :auto-resize="props.autoResize"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.md-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.md-toolbar {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem 0;
}
.md-tool {
  border: none;
  background: none;
  color: var(--p-text-muted-color);
  border-radius: 4px;
  padding: 0.25rem 0.4rem;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
}
.md-tool:hover {
  background: var(--p-content-hover-background);
  color: var(--p-text-color);
}
.md-tool .b {
  font-weight: 700;
}
.md-tool .i {
  font-style: italic;
  font-family: serif;
}
.md-spacer {
  flex: 1;
}
.md-preview-toggle {
  font-size: 0.75rem;
}
.md-preview {
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  min-height: 4rem;
}
.md-editor :deep(textarea) {
  width: 100%;
}
</style>
