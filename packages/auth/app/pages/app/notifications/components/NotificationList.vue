<!-- Translation file -->
<i18n src="../index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: List of notifications
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import NotificationItem from './NotificationItem.vue'

const props = defineProps<{
  notifications: any[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'mark-read', id: string): void
  (e: 'delete', id: string): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-4">
      <USkeleton class="h-24 w-full" v-for="i in 3" :key="i" />
    </div>

    <div v-else-if="notifications.length === 0" class="text-center py-12">
      <UIcon name="i-lucide-bell-off" class="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium">{{ t('empty.title') }}</h3>
      <p class="text-muted-foreground">{{ t('empty.description') }}</p>
    </div>

    <div v-else class="space-y-2">
      <NotificationItem v-for="notification in notifications" :key="notification.id" :notification="notification"
        @mark-read="emit('mark-read', $event)" @delete="emit('delete', $event)" />
    </div>
  </div>
</template>
