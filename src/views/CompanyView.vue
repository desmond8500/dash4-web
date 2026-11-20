<script setup lang="ts">
import { computed, ref } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Card from 'primevue/card'
import { useAuthStore } from '@/stores/auth'
import CompanyIdentityPanel from '@/components/company/CompanyIdentityPanel.vue'
import BankAccountsPanel from '@/components/company/BankAccountsPanel.vue'
import SignaturePanel from '@/components/company/SignaturePanel.vue'
import SettingsPanel from '@/components/company/SettingsPanel.vue'
import { companyTabs } from '@/utils/companyTabs'

const auth = useAuthStore()
const tabs = computed(() => companyTabs((p) => auth.can(p)))
const tab = ref(tabs.value[0]?.value ?? 'settings')
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>Entreprise et paramètres</h1>
    </div>

    <Card>
      <template #content>
        <Tabs v-model:value="tab">
          <TabList>
            <Tab v-for="t in tabs" :key="t.value" :value="t.value"><i :class="t.icon" /> {{ t.label }}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="identity"><CompanyIdentityPanel /></TabPanel>
            <TabPanel value="bank"><BankAccountsPanel /></TabPanel>
            <TabPanel value="signature"><SignaturePanel /></TabPanel>
            <TabPanel value="settings"><SettingsPanel /></TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
