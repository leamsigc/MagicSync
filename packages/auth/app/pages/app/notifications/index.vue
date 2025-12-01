<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Notifications page
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import NotificationList from './components/NotificationList.vue'

const { t } = useI18n()
const {
  notifications,
  loading,
  fetchNotifications,
  markAsRead,
  deleteNotification,
  markAllAsRead,
  unreadCount
} = useNotificationManagement()

const filter = ref('all')
const page = ref(1)

// Fetch on mount
onMounted(() => {
  fetchNotifications()
})

// Watch filter changes
watch(filter, () => {
  page.value = 1
  fetchNotifications({ type: filter.value === 'all' ? undefined : filter.value })
})

const handleMarkRead = async (id: string) => {
  await markAsRead(id)
}

const handleDelete = async (id: string) => {
  await deleteNotification(id)
}

const handleMarkAllRead = async () => {
  await markAllAsRead()
}

const items = computed(() => [
  { label: t('filters.all'), slot: 'all', value: 'all' },
  { label: t('filters.unread'), slot: 'unread', value: 'unread' }
])

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }]
})
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">{{ t('heading') }}</h1>
        <p class="text-muted-foreground">{{ t('subheading') }}</p>
      </div>

      <UButton v-if="unreadCount > 0" variant="outline" icon="i-lucide-check-check" @click="handleMarkAllRead">
        {{ t('actions.markAllRead') }}
      </UButton>
    </div>

    <UTabs :items="items" v-model="filter" class="w-full">
      <template #all>
        <NotificationList class="mt-6" :notifications="notifications" :loading="loading" @mark-read="handleMarkRead"
          @delete="handleDelete" />
      </template>
      <template #unread>
        <NotificationList class="mt-6" :notifications="notifications.filter(n => !n.isRead)" :loading="loading"
          @mark-read="handleMarkRead" @delete="handleDelete" />
      </template>
    </UTabs>
  </UContainer>
</template>

<style scoped></style>
