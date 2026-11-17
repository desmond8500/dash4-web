import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'
import './style.css'

import App from './App.vue'
import { router } from './router'
import { primeVueFr } from './locale-fr'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: { darkModeSelector: '.app-dark' },
  },
  locale: primeVueFr,
})
app.use(ToastService)
app.use(ConfirmationService)

app.mount('#app')
