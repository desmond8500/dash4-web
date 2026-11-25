<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { activeEntry, type MenuEntry, type MenuGroupKey, type MenuNode } from '@/menu'

/**
 * Menus et sous-menus de la barre latérale (et du tiroir sur petit écran).
 * Dépliée : chaque menu s'ouvre et se referme (état gardé), celui de la page ouverte reste ouvert.
 * Réduite : l'icône d'un menu ouvre la liste de ses sous-menus à côté.
 */
const props = defineProps<{ nodes: MenuNode[]; collapsed?: boolean; badgeFor: (entry: MenuEntry) => number }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const router = useRouter()

const entries = computed(() => props.nodes.flatMap((n) => (n.kind === 'link' ? [n.entry] : n.entries)))
const active = computed(() => activeEntry(entries.value, route.path))

// Menus ouverts, gardés pour les prochaines visites
const OPEN_KEY = 'dash4.sidebar.open'
function readOpen(): Set<MenuGroupKey> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as MenuGroupKey[])
  } catch {
    return new Set()
  }
}
const open = ref(readOpen())
function setOpen(key: MenuGroupKey, on: boolean): void {
  const next = new Set(open.value)
  if (on) next.add(key)
  else next.delete(key)
  open.value = next
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...next]))
  } catch {
    // stockage indisponible : l'état ne sera pas gardé
  }
}

// Le menu de la page ouverte s'ouvre de lui-même
watch(
  () => active.value?.group,
  (group) => {
    if (group && !open.value.has(group)) setOpen(group, true)
  },
  { immediate: true },
)

const groupBadge = (list: MenuEntry[]) => list.reduce((sum, e) => sum + props.badgeFor(e), 0)
const containsActive = (list: MenuEntry[]) => !!active.value && list.includes(active.value)

// Barre réduite : liste des sous-menus à côté de l'icône
const flyout = ref<InstanceType<typeof Menu> | null>(null)
const flyoutItems = ref<MenuItem[]>([])
function showFlyout(event: Event, node: Extract<MenuNode, { kind: 'group' }>): void {
  flyoutItems.value = [
    { label: node.group.label, items: node.entries.map((e) => {
      const count = props.badgeFor(e)
      return { label: count ? `${e.label} (${count})` : e.label, icon: e.icon, command: () => go(e.to) }
    }) },
  ]
  flyout.value?.toggle(event)
}

function go(to: string): void {
  void router.push(to)
  emit('navigate')
}
</script>

<template>
  <nav class="sidebar-nav" :class="{ collapsed: props.collapsed }">
    <template v-for="node in props.nodes" :key="node.kind === 'link' ? node.entry.to : node.group.key">
      <RouterLink
        v-if="node.kind === 'link'"
        :to="node.entry.to"
        class="nav-link"
        :class="{ active: active === node.entry }"
        :aria-current="active === node.entry ? 'page' : undefined"
        :title="props.collapsed ? node.entry.label : undefined"
        @click="emit('navigate')"
      >
        <i :class="node.entry.icon" />
        <span class="label">{{ node.entry.label }}</span>
        <span v-if="props.badgeFor(node.entry)" class="nav-badge">{{ props.badgeFor(node.entry) }}</span>
        <span v-if="props.collapsed && props.badgeFor(node.entry)" class="dot" aria-hidden="true" />
      </RouterLink>

      <!-- Barre réduite : icône du menu, sous-menus à côté -->
      <button
        v-else-if="props.collapsed"
        type="button"
        class="nav-link group-head"
        :class="{ active: containsActive(node.entries) }"
        :title="node.group.label"
        :aria-label="node.group.label"
        aria-haspopup="true"
        @click="showFlyout($event, node)"
      >
        <i :class="node.group.icon" />
        <span v-if="groupBadge(node.entries)" class="dot" aria-hidden="true" />
      </button>

      <!-- Barre dépliée : menu qui s'ouvre et se referme -->
      <div v-else class="group">
        <button
          type="button"
          class="nav-link group-head"
          :class="{ 'has-active': containsActive(node.entries) }"
          :aria-expanded="open.has(node.group.key)"
          :aria-controls="`menu-${node.group.key}`"
          @click="setOpen(node.group.key, !open.has(node.group.key))"
        >
          <i :class="node.group.icon" />
          <span class="label">{{ node.group.label }}</span>
          <span v-if="!open.has(node.group.key) && groupBadge(node.entries)" class="nav-badge">{{ groupBadge(node.entries) }}</span>
          <i class="pi chevron" :class="open.has(node.group.key) ? 'pi-angle-down' : 'pi-angle-right'" aria-hidden="true" />
        </button>
        <div v-show="open.has(node.group.key)" :id="`menu-${node.group.key}`" class="children">
          <RouterLink
            v-for="entry in node.entries"
            :key="entry.to"
            :to="entry.to"
            class="nav-link child"
            :class="{ active: active === entry }"
            :aria-current="active === entry ? 'page' : undefined"
            @click="emit('navigate')"
          >
            <i :class="entry.icon" />
            <span class="label">{{ entry.label }}</span>
            <span v-if="props.badgeFor(entry)" class="nav-badge">{{ props.badgeFor(entry) }}</span>
          </RouterLink>
        </div>
      </div>
    </template>
    <Menu ref="flyout" :model="flyoutItems" popup />
  </nav>
</template>

<style scoped>
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--p-text-color);
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  position: relative;
}

.nav-link:hover {
  background: var(--p-content-hover-background);
}

.nav-link.active {
  background: var(--p-highlight-background);
  color: var(--p-highlight-color);
  font-weight: 600;
}

.group-head.has-active {
  font-weight: 600;
}

.chevron {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.nav-badge + .chevron {
  margin-left: 0.4rem;
}

.children {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 2px 0 6px 1.1rem;
  padding-left: 0.5rem;
  border-left: 1px solid var(--p-content-border-color);
}

.child {
  padding: 0.45rem 0.6rem;
  font-size: 0.925rem;
}

.child i {
  font-size: 0.9rem;
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

/* Barre réduite : icônes seules */
.collapsed .nav-link {
  justify-content: center;
  padding: 0.625rem;
}

.collapsed .label,
.collapsed .nav-badge {
  display: none;
}

.dot {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--p-primary-color);
}
</style>
