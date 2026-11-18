<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { ApiError, SIGNATURE_DOCUMENT_LABELS } from '@dash4/shared'
import type { Company, SignatureDocument } from '@dash4/shared'
import { api } from '@/services/api'
import { signatureImageError } from '@/utils/company'

type Kind = 'signature' | 'stamp'

const toast = useToast()
const confirm = useConfirm()

const company = ref<Company | null>(null)
const previews = ref<Record<Kind, string | null>>({ signature: null, stamp: null })
const busy = ref<Kind | null>(null)
const inputs = ref<Record<Kind, HTMLInputElement | null>>({ signature: null, stamp: null })

const kinds: Array<{ kind: Kind; label: string; hint: string }> = [
  { kind: 'signature', label: 'Signature', hint: 'La signature du responsable, sur fond transparent.' },
  { kind: 'stamp', label: 'Cachet', hint: "Le cachet de l'entreprise, sur fond transparent." },
]
const documents = Object.entries(SIGNATURE_DOCUMENT_LABELS) as Array<[SignatureDocument, string]>

async function loadPreview(kind: Kind): Promise<void> {
  if (previews.value[kind]) URL.revokeObjectURL(previews.value[kind]!)
  previews.value[kind] = null
  const has = kind === 'signature' ? company.value?.signature?.has_signature : company.value?.signature?.has_stamp
  if (!has) return
  try {
    previews.value[kind] = URL.createObjectURL(await api.company.image(kind))
  } catch {
    // aperçu facultatif
  }
}

async function refresh(c: Company): Promise<void> {
  company.value = c
  await Promise.all([loadPreview('signature'), loadPreview('stamp')])
}

onMounted(async () => {
  try {
    await refresh(await api.company.get())
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Chargement impossible', detail: (e as Error).message, life: 5000 })
  }
})

onBeforeUnmount(() => Object.values(previews.value).forEach((url) => url && URL.revokeObjectURL(url)))

async function onFile(kind: Kind, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const error = signatureImageError(file)
  if (error) {
    toast.add({ severity: 'warn', summary: 'Image refusée', detail: error, life: 5000 })
    return
  }
  busy.value = kind
  try {
    await refresh(await api.company.uploadImage(kind, file, file.name))
    toast.add({ severity: 'success', summary: 'Image enregistrée', detail: 'Les administrateurs ont été prévenus.', life: 3000 })
  } catch (e) {
    const detail = e instanceof ApiError ? (e.fieldError('image') ?? e.message) : (e as Error).message
    toast.add({ severity: 'error', summary: 'Envoi impossible', detail, life: 5000 })
  } finally {
    busy.value = null
  }
}

function remove(kind: Kind): void {
  confirm.require({
    header: 'Retirer l\'image',
    message: 'Les documents ne la montreront plus. Les administrateurs seront prévenus.',
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { label: 'Retirer', severity: 'danger' },
    rejectProps: { label: 'Annuler', severity: 'secondary', text: true },
    accept: async () => {
      busy.value = kind
      try {
        await refresh(await api.company.removeImage(kind))
      } finally {
        busy.value = null
      }
    },
  })
}

async function toggleDocument(doc: SignatureDocument, value: boolean): Promise<void> {
  try {
    company.value = await api.company.update({ signature_on: { [doc]: value } })
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Modification impossible', detail: (e as Error).message, life: 5000 })
  }
}

function setInput(kind: Kind, el: unknown): void {
  inputs.value[kind] = (el as HTMLInputElement | null) ?? null
}
</script>

<template>
  <div v-if="company?.signature" class="panel">
    <div class="images">
      <div v-for="item in kinds" :key="item.kind" class="image-card">
        <strong>{{ item.label }}</strong>
        <div class="preview">
          <img v-if="previews[item.kind]" :src="previews[item.kind]!" :alt="item.label" />
          <span v-else class="muted">Aucune image</span>
        </div>
        <small class="muted">{{ item.hint }} PNG, 2 Mo au plus.</small>
        <div class="actions">
          <Button
            :label="previews[item.kind] ? 'Remplacer' : 'Ajouter'"
            icon="pi pi-upload"
            size="small"
            :loading="busy === item.kind"
            @click="inputs[item.kind]?.click()"
          />
          <Button
            v-if="previews[item.kind]"
            label="Retirer"
            size="small"
            text
            severity="danger"
            :disabled="busy === item.kind"
            @click="remove(item.kind)"
          />
          <input :ref="(el) => setInput(item.kind, el)" type="file" accept="image/png" hidden @change="onFile(item.kind, $event)" />
        </div>
      </div>
    </div>

    <div>
      <strong>Documents qui affichent la signature et le cachet</strong>
      <div class="documents">
        <label v-for="[doc, label] in documents" :key="doc" class="doc">
          <Checkbox
            :model-value="company.signature.on[doc]"
            binary
            @update:model-value="(v: boolean) => toggleDocument(doc, v)"
          />
          {{ label }}
        </label>
      </div>
      <p class="muted small">
        Les clients signent eux-mêmes les documents reçus ; la copie signée pourra être jointe au document.
      </p>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.image-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
}

.preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 140px;
  border-radius: 8px;
  /* Damier : on voit si le fond est bien transparent */
  background: repeating-conic-gradient(#f1f1f1 0% 25%, #ffffff 0% 50%) 50% / 16px 16px;
}

.preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.documents {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  margin-top: 0.75rem;
}

.doc {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.small {
  font-size: 0.85rem;
}
</style>
