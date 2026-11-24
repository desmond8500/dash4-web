<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import Textarea from 'primevue/textarea'
import { applyMarkdown, continueList, indentList, type MarkdownAction, type MarkdownEdit } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'
import { liveMarkdownPreview, setLiveMarkdownPreview } from '@/utils/markdownEditor'

/**
 * Zone de texte avec mise en forme Markdown : barre d'outils (gras, italique, titre, listes, case à cocher,
 * citation, lien), aperçu, et aperçu « en direct » sous la zone (mis en forme pendant la saisie).
 * Comme dans VS Code : Entrée dans une liste reprend la puce (une puce vide arrête la liste),
 * Tab / Maj+Tab décalent les éléments de liste. Les attributs (id, rows, placeholder, fluid…) vont à la zone de texte.
 */
defineOptions({ inheritAttrs: false })
const model = defineModel<string | null | undefined>()
const props = withDefaults(defineProps<{ disabled?: boolean; autoResize?: boolean }>(), { disabled: false, autoResize: true })

const root = ref<HTMLElement | null>(null)
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
  return root.value?.querySelector('textarea') ?? null
}

/**
 * Remplace le texte comme le ferait une saisie (la touche Ctrl+Z annule le changement et l'événement
 * « change » part bien à la sortie du champ) ; à défaut, change directement la valeur.
 */
async function replace(el: HTMLTextAreaElement | null, before: string, result: MarkdownEdit): Promise<void> {
  if (el) {
    let head = 0
    while (head < before.length && head < result.text.length && before[head] === result.text[head]) head++
    let tail = 0
    while (tail < before.length - head && tail < result.text.length - head && before[before.length - 1 - tail] === result.text[result.text.length - 1 - tail]) tail++
    const inserted = result.text.slice(head, result.text.length - tail)
    el.focus()
    el.setSelectionRange(head, before.length - tail)
    const done = inserted ? document.execCommand('insertText', false, inserted) : document.execCommand('delete')
    if (done && el.value === result.text) {
      model.value = el.value
      el.setSelectionRange(result.start, result.end)
      return
    }
  }
  model.value = result.text
  await nextTick()
  el?.focus()
  el?.setSelectionRange(result.start, result.end)
}

async function apply(action: MarkdownAction): Promise<void> {
  const el = element()
  const text = model.value ?? ''
  await replace(el, text, applyMarkdown(text, el?.selectionStart ?? text.length, el?.selectionEnd ?? text.length, action))
}

function onKeydown(e: KeyboardEvent): void {
  // Touche déjà prise par la page (ex. choix d'une mention @ dans les commentaires)
  if (e.defaultPrevented) return
  const el = e.target as HTMLTextAreaElement
  const text = model.value ?? ''
  // Listes : Entrée reprend la puce, Tab / Maj+Tab décalent
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
    const result =
      e.key === 'Enter' && !e.shiftKey
        ? continueList(text, el.selectionStart, el.selectionEnd)
        : e.key === 'Tab'
          ? indentList(text, el.selectionStart, el.selectionEnd, e.shiftKey)
          : null
    if (result) {
      e.preventDefault()
      void replace(el, text, result)
    }
    return
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return
  const key = e.key.toLowerCase()
  if (key === 'b' || key === 'i') {
    e.preventDefault()
    void apply(key === 'b' ? 'bold' : 'italic')
  }
}
</script>

<template>
  <div ref="root" class="md-editor" :class="{ disabled: props.disabled }">
    <div v-if="!props.disabled" class="md-toolbar" role="toolbar" aria-label="Mise en forme">
      <template v-if="!preview">
        <button v-for="t in tools" :key="t.action" type="button" class="md-tool" :title="t.title" :aria-label="t.title" @mousedown.prevent @click="apply(t.action)">
          <i v-if="t.icon" :class="t.icon" />
          <span v-else :class="{ b: t.action === 'bold', i: t.action === 'italic' }">{{ t.text }}</span>
        </button>
      </template>
      <span class="md-spacer" />
      <button
        v-if="!preview"
        type="button"
        class="md-tool md-preview-toggle"
        :class="{ active: liveMarkdownPreview }"
        :aria-pressed="liveMarkdownPreview"
        title="Afficher le texte mis en forme sous la zone, pendant la saisie (réglage gardé pour toutes les zones de texte)"
        @mousedown.prevent
        @click="setLiveMarkdownPreview(!liveMarkdownPreview)"
      >
        <i class="pi pi-eye" /> En direct
      </button>
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
      v-model="model"
      v-bind="$attrs"
      :disabled="props.disabled"
      :auto-resize="props.autoResize"
      @keydown="onKeydown"
    />
    <div v-if="liveMarkdownPreview && !preview && !props.disabled && !empty" class="md-live" aria-live="off">
      <MarkdownView :text="model" />
    </div>
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
.md-preview-toggle.active {
  color: var(--p-primary-color);
}
.md-live {
  margin-top: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-left: 3px solid var(--p-primary-color);
  background: var(--p-content-hover-background);
  border-radius: 0 6px 6px 0;
  font-size: 0.9rem;
  max-height: 18rem;
  overflow: auto;
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
