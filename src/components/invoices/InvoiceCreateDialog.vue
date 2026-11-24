<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import RadioButton from 'primevue/radiobutton'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { ApiError, formatMoney, INVOICE_SCOPES } from '@dash4/shared'
import type { Currency, Invoice, InvoiceCreatePayload, InvoiceScope, Quote } from '@dash4/shared'
import { api } from '@/services/api'
import { defaultInvoiceTitle, invoicePreview } from '@/utils/invoices'
import ClientPicker, { type ClientOption } from '@/components/ClientPicker.vue'

/**
 * Nouvelle facture (brouillon). Avec un devis : partie facturée (tout, matériel, matériel + accessoires,
 * main-d'œuvre, reliquat), pourcentage et titre ; ou un acompte prévu sur le devis.
 * Sans devis : facture libre pour un client.
 */
const props = defineProps<{ quote?: Quote | null; currency: Currency }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [invoice: Invoice] }>()

type Scope = Exclude<InvoiceScope, 'custom'>
const source = ref<'quote' | 'deposit'>('quote')
const scope = ref<Scope>('all')
const percent = ref(100)
const title = ref('')
const titleTouched = ref(false)
const depositId = ref<number | null>(null)
const client = ref<ClientOption | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)

const invoicedDeposits = computed(() => new Set((props.quote?.invoices ?? []).filter((i) => i.status.value !== 'cancelled').map((i) => i.quote_deposit_id)))
const deposits = computed(() => (props.quote?.deposits ?? []).filter((d) => !invoicedDeposits.value.has(d.id)))
const percentPresets = [30, 40, 50, 60, 100]
const preview = computed(() => (props.quote ? invoicePreview(props.quote, scope.value, percent.value) : 0))
const money = (v: number) => formatMoney(v, props.currency)

watch(visible, (open) => {
  if (!open) return
  error.value = null
  source.value = 'quote'
  scope.value = props.quote && props.quote.invoices?.length ? 'remainder' : 'all'
  percent.value = 100
  titleTouched.value = false
  depositId.value = deposits.value[0]?.id ?? null
  client.value = null
  title.value = props.quote ? defaultInvoiceTitle(scope.value, percent.value) : 'Facture'
})

// Titre proposé tant que l'utilisateur ne l'a pas changé
watch([scope, percent], () => {
  if (scope.value === 'remainder') percent.value = 100
  if (!titleTouched.value) title.value = defaultInvoiceTitle(scope.value, percent.value)
})

async function save(): Promise<void> {
  error.value = null
  let payload: InvoiceCreatePayload
  if (!props.quote) {
    const c = client.value && typeof client.value === 'object' ? client.value : null
    if (!c) {
      error.value = 'Choisissez le client à facturer.'
      return
    }
    payload = { client_id: c.id, title: title.value.trim() || 'Facture' }
  } else if (source.value === 'deposit') {
    if (!depositId.value) return
    payload = { quote_deposit_id: depositId.value }
  } else {
    payload = { quote_id: props.quote.id, scope: scope.value, percent: percent.value, title: title.value.trim() || null }
  }
  saving.value = true
  try {
    const invoice = await api.invoices.create({ ...payload, client_uuid: crypto.randomUUID() })
    visible.value = false
    emit('created', invoice)
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Création impossible. Réessayez.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="props.quote ? `Facturer le devis ${props.quote.number}` : 'Nouvelle facture'"
    modal
    :style="{ width: '600px' }"
    :breakpoints="{ '650px': '95vw' }"
  >
    <form id="invoice-create" class="form-grid" @submit.prevent="save">
      <Message v-if="error" class="form-field--full" severity="error" :closable="false">{{ error }}</Message>

      <template v-if="props.quote">
        <div v-if="deposits.length" class="form-field form-field--full">
          <SelectButton
            v-model="source"
            :options="[{ v: 'quote', l: 'Partie du devis' }, { v: 'deposit', l: 'Acompte prévu' }]"
            option-label="l"
            option-value="v"
            :allow-empty="false"
          />
        </div>

        <template v-if="source === 'quote'">
          <div class="form-field form-field--full">
            <label>Partie facturée</label>
            <div class="choices">
              <label v-for="s in INVOICE_SCOPES" :key="s.value" class="choice">
                <RadioButton v-model="scope" :value="s.value" name="scope" />
                {{ s.label }}
              </label>
            </div>
          </div>
          <div v-if="scope !== 'remainder'" class="form-field form-field--full">
            <label for="i-percent">Pourcentage</label>
            <div class="percent">
              <InputNumber v-model="percent" input-id="i-percent" :min="0.01" :max="100" :max-fraction-digits="2" suffix=" %" />
              <Button v-for="p in percentPresets" :key="p" :label="p === 100 ? '100 %' : `${p} %`" size="small" :outlined="percent !== p" @click="percent = p" />
            </div>
            <small class="muted">Moins de 100 % : une seule ligne « Acompte de X % ». 100 % : les lignes du devis sont reprises.</small>
          </div>
          <p v-else class="form-field--full muted small">
            Tout le devis moins ce qui est déjà facturé (factures non annulées, brouillons compris).
          </p>
        </template>

        <div v-else class="form-field form-field--full">
          <label>Acompte</label>
          <div class="choices">
            <label v-for="d in deposits" :key="d.id" class="choice">
              <RadioButton v-model="depositId" :value="d.id" name="deposit" />
              {{ d.label }} — {{ money(d.amount) }}
            </label>
          </div>
        </div>
      </template>

      <div v-else class="form-field form-field--full">
        <label for="i-client">Client</label>
        <ClientPicker v-model="client" input-id="i-client" />
      </div>

      <div v-if="!props.quote || source === 'quote'" class="form-field form-field--full">
        <label for="i-title">Titre de la facture</label>
        <InputText id="i-title" v-model="title" @input="titleTouched = true" />
      </div>

      <p v-if="props.quote && source === 'quote'" class="form-field--full estimate">
        Montant estimé : <strong>{{ money(preview) }}</strong> hors taxes
      </p>
      <p class="form-field--full muted small">
        La facture est créée en brouillon, sans numéro : vous pourrez la relire et la modifier avant de l'émettre.
      </p>
    </form>
    <template #footer>
      <Button label="Annuler" severity="secondary" text @click="visible = false" />
      <Button label="Créer le brouillon" icon="pi pi-check" type="submit" form="invoice-create" :loading="saving" />
    </template>
  </Dialog>
</template>

<style scoped>
.choices {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.choice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.percent {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  align-items: center;
}

.small {
  margin: 0;
  font-size: 0.85rem;
}

.estimate {
  margin: 0;
}
</style>
