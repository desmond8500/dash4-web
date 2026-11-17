<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Menu from 'primevue/menu'
import Drawer from 'primevue/drawer'
import { useAuthStore } from '@/stores/auth'
import { visibleMenu } from '@/menu'

const auth = useAuthStore()
const router = useRouter()

const mobileMenuOpen = ref(false)
const userMenu = ref<InstanceType<typeof Menu> | null>(null)
const dark = ref(document.documentElement.classList.contains('app-dark'))

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

function toggleDark(): void {
  dark.value = !dark.value
  document.documentElement.classList.toggle('app-dark', dark.value)
  localStorage.setItem('dash4.dark', dark.value ? '1' : '0')
}

async function logout(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}

if (localStorage.getItem('dash4.dark') === '1' && !dark.value) toggleDark()
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <RouterLink to="/" class="brand">Dash4</RouterLink>
      <nav>
        <RouterLink v-for="entry in entries" :key="entry.to" :to="entry.to" class="nav-link">
          <i :class="entry.icon" />
          <span>{{ entry.label }}</span>
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
}

.brand {
  display: block;
  padding: 0 0.75rem 1.25rem;
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--p-primary-color);
  text-decoration: none;
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
