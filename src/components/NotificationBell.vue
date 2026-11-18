<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import OverlayBadge from 'primevue/overlaybadge'
import type { AppNotification } from '@dash4/shared'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { ageLabel } from '@/utils/clientRequests'

const store = useClientRequestsStore()
const router = useRouter()
const panel = ref<InstanceType<typeof Popover> | null>(null)

function toggle(event: Event): void {
  panel.value?.toggle(event)
  void store.refreshNotifications()
}

async function open(notification: AppNotification): Promise<void> {
  if (!notification.read_at) await store.markRead(notification.id)
  panel.value?.hide()
  if (notification.client_request_id) {
    void router.push({ name: 'client-requests', query: { demande: notification.client_request_id } })
  }
}
</script>

<template>
  <OverlayBadge v-if="store.unreadCount" :value="store.unreadCount" severity="danger">
    <Button icon="pi pi-bell" text rounded aria-label="Notifications" @click="toggle" />
  </OverlayBadge>
  <Button v-else icon="pi pi-bell" text rounded aria-label="Notifications" @click="toggle" />

  <Popover ref="panel">
    <div class="panel">
      <div class="panel-header">
        <strong>Notifications</strong>
        <Button
          v-if="store.unreadCount"
          label="Tout marquer comme lu"
          size="small"
          text
          @click="store.markAllRead()"
        />
      </div>
      <p v-if="!store.notifications.length" class="muted empty">Aucune notification.</p>
      <button
        v-for="n in store.notifications"
        :key="n.id"
        type="button"
        class="item"
        :class="{ unread: !n.read_at }"
        @click="open(n)"
      >
        <span class="title">{{ n.title }}</span>
        <span class="body">{{ n.body }}</span>
        <span class="muted when">{{ ageLabel(n.created_at) }}</span>
      </button>
    </div>
  </Popover>
</template>

<style scoped>
.panel {
  width: min(360px, 85vw);
  max-height: 420px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.empty {
  margin: 0.5rem 0;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  width: 100%;
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.item:hover {
  background: var(--p-content-hover-background);
}

.item.unread .title::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 0.375rem;
  border-radius: 50%;
  background: var(--p-primary-color);
}

.title {
  font-weight: 600;
  font-size: 0.9rem;
}

.body {
  font-size: 0.85rem;
}

.when {
  font-size: 0.75rem;
}
</style>
