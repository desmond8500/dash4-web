<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Menu from 'primevue/menu'
import Drawer from 'primevue/drawer'
import { useAuthStore } from '@/stores/auth'
import { visibleMenu, type MenuEntry } from '@/menu'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { useMessagingStore } from '@/stores/messaging'
import { api } from '@/services/api'
import { applyTheme, storedTheme, toggledTheme } from '@/utils/theme'
import { useToast } from 'primevue/usetoast'
import NotificationBell from '@/components/NotificationBell.vue'
import ClientRequestDialog from '@/components/ClientRequestDialog.vue'
import ScrollTopButton from '@/components/ScrollTopButton.vue'

const auth = useAuthStore()
const router = useRouter()
const requests = useClientRequestsStore()
const messaging = useMessagingStore()
const toast = useToast()

function badgeFor(entry: MenuEntry): number {
  if (entry.badge === 'messages') return messaging.unread
  return entry.badge === 'client_requests' ? (requests.summary?.open ?? 0) : 0
}

function onRequestSaved(): void {
  toast.add({ severity: 'success', summary: 'Demande notée', detail: 'Elle est dans la boîte « À traiter ».', life: 3000 })
  requests.changed()
}

onMounted(() => {
  requests.start()
  messaging.start()
})
onUnmounted(() => {
  requests.stop()
  messaging.stop()
})

const mobileMenuOpen = ref(false)
const userMenu = ref<InstanceType<typeof Menu> | null>(null)

// Barre latérale réduite/dépliée (desktop uniquement), mémorisée pour les prochaines visites
const SIDEBAR_KEY = 'dash4.sidebar.collapsed'
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1')
function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
}

const entries = computed(() => visibleMenu(auth.canAny))
const initials = computed(() =>
  auth.user ? `${auth.user.firstname[0] ?? ''}${auth.user.lastname[0] ?? ''}`.toUpperCase() : '',
)

const userMenuItems = [
  { label: 'Mon profil', icon: 'pi pi-user', command: () => router.push({ name: 'profile' }) },
  { label: 'Thème clair / sombre', icon: 'pi pi-moon', command: () => toggleDark() },
  { separator: true },
  { label: 'Se déconnecter', icon: 'pi pi-sign-out', command: () => logout() },
]

/** Bascule clair / sombre, enregistrée dans les préférences du compte. */
function toggleDark(): void {
  const theme = toggledTheme(auth.user?.preferences?.theme ?? storedTheme())
  applyTheme(theme)
  if (auth.user?.preferences) auth.user.preferences.theme = theme
  void api.profile.update({ preferences: { theme } }).catch(() => undefined)
}

async function logout(): Promise<void> {
  requests.stop()
  await auth.logout()
  await router.push({ name: 'login' })
}


// Raccourci « N » : noter une demande, sauf pendant une saisie
function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  const typing = target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
  if (event.key.toLowerCase() === 'n' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (auth.can('client_requests.create') && !requests.quickOpen) {
      event.preventDefault()
      requests.openQuick()
    }
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="layout">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="brand-row">
        <RouterLink to="/" class="brand">{{ sidebarCollapsed ? 'D4' : 'Dash4' }}</RouterLink>
        <Button
          class="sidebar-toggle"
          :icon="sidebarCollapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
          text
          rounded
          size="small"
          severity="secondary"
          :aria-label="sidebarCollapsed ? 'Déplier le menu' : 'Réduire le menu'"
          :aria-expanded="!sidebarCollapsed"
          :title="sidebarCollapsed ? 'Déplier le menu' : 'Réduire le menu'"
          @click="toggleSidebar"
        />
      </div>
      <nav>
        <RouterLink
          v-for="entry in entries"
          :key="entry.to"
          :to="entry.to"
          class="nav-link"
          :title="sidebarCollapsed ? entry.label : undefined"
        >
          <i :class="entry.icon" />
          <span>{{ entry.label }}</span>
          <span v-if="badgeFor(entry)" class="nav-badge">{{ badgeFor(entry) }}</span>
        </RouterLink>
      </nav>
    </aside>

    <Drawer v-model:visible="mobileMenuOpen" header="Dash4">
      <nav>
        <RouterLink
          v-for="entry in entries"
          :key="entry.to"
          :to="entry.to"
          class="nav-link"
          @click="mobileMenuOpen = false"
        >
          <i :class="entry.icon" />
          <span>{{ entry.label }}</span>
          <span v-if="badgeFor(entry)" class="nav-badge">{{ badgeFor(entry) }}</span>
        </RouterLink>
      </nav>
    </Drawer>

    <div class="main">
      <header class="topbar">
        <Button
          class="menu-button"
          icon="pi pi-bars"
          text
          rounded
          aria-label="Ouvrir le menu"
          @click="mobileMenuOpen = true"
        />
        <span class="spacer" />
        <Button
          v-if="auth.can('client_requests.create')"
          label="Demande"
          icon="pi pi-plus"
          size="small"
          title="Noter une demande client (raccourci : N)"
          @click="requests.openQuick()"
        />
        <NotificationBell />
        <button type="button" class="user-button" @click="userMenu?.toggle($event)">
          <Avatar :label="initials" shape="circle" />
          <span class="user-name">{{ auth.user?.full_name }}</span>
          <i class="pi pi-angle-down" />
        </button>
        <Menu ref="userMenu" :model="userMenuItems" popup />
      </header>

      <main class="content">
        <RouterView />
      </main>
      <ScrollTopButton />

      <ClientRequestDialog
        v-model:visible="requests.quickOpen"
        :request="null"
        :client-id="requests.quickClientId"
        @saved="onRequestSaved"
      />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  padding: 1.25rem 0.75rem;
  background: var(--p-content-background);
  border-right: 1px solid var(--p-content-border-color);
  transition: width 0.15s ease;
}

.sidebar.collapsed {
  width: 68px;
  padding: 1.25rem 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}

.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0 0.75rem 1.25rem;
}

.sidebar.collapsed .brand-row {
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 0 1.25rem;
}

.brand {
  display: block;
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--p-primary-color);
  text-decoration: none;
}

.sidebar.collapsed .brand {
  font-size: 1.125rem;
}

.sidebar-toggle {
  flex-shrink: 0;
}

.sidebar.collapsed .nav-link {
  justify-content: center;
  padding: 0.625rem;
}

.sidebar.collapsed .nav-link span {
  display: none;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  color: var(--p-text-color);
  text-decoration: none;
}

.nav-badge {
  margin-left: auto;
  min-width: 1.4rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
}

.nav-link:hover {
  background: var(--p-content-hover-background);
}

.nav-link.router-link-exact-active {
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
  font-weight: 600;
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-content-border-color);
}

.spacer {
  flex: 1;
}

.menu-button {
  display: none;
}

.user-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.user-button:hover {
  background: var(--p-content-hover-background);
}

.content {
  padding: 1.5rem;
}

@media (max-width: 900px) {
  .sidebar {
    display: none;
  }

  .menu-button {
    display: inline-flex;
  }

  .user-name {
    display: none;
  }

  .content {
    padding: 1rem;
  }
}
</style>
