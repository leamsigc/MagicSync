<!-- Translation file -->
<i18n src="../index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Single notification item
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

interface NotificationType {
  id: string
  title: string
  message?: string
  type: 'info' | 'success' | 'warning' | 'error'
  isRead: boolean
  createdAt: string
  // Add other fields as necessary
}

const props = defineProps<{
  notification: NotificationType
}>()

const emit = defineEmits<{
  (e: 'mark-read', id: string): void
  (e: 'delete', id: string): void
}>()

const { t } = useI18n()

const iconMap = {
  info: 'i-lucide-info',
  success: 'i-lucide-check-circle',
  warning: 'i-lucide-alert-triangle',
  error: 'i-lucide-x-circle'
}

const colorMap = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error'
}

const timeAgo = computed(() => {
  const date = new Date(props.notification.createdAt)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return t('time.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('time.daysAgo', { count: days })
})
</script>

<template>
  <div class="flex items-start gap-4 p-4 rounded-lg border transition-colors" :class="[
    notification.isRead ? 'bg-background border-border' : 'bg-primary/5 border-primary/20'
  ]">
    <!-- Icon -->
    <div class="flex-shrink-0 mt-1">
      <UIcon :name="iconMap[notification.type] || iconMap.info" class="w-5 h-5"
        :class="`text-${colorMap[notification.type]}`" />
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2 mb-1">
        <h4 class="text-sm font-medium leading-none truncate">
          {{ notification.title }}
        </h4>
        <span class="text-xs text-muted-foreground whitespace-nowrap">
          {{ timeAgo }}
        </span>
      </div>

      <p v-if="notification.message" class="text-sm text-muted-foreground line-clamp-2">
        {{ notification.message }}
      </p>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1 -mt-1 -mr-2">
      <UTooltip :text="t('actions.markAsRead')" v-if="!notification.isRead">
        <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-check"
          @click="emit('mark-read', notification.id)" />
      </UTooltip>

      <UTooltip :text="t('actions.delete')">
        <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2"
          @click="emit('delete', notification.id)" />
      </UTooltip>
    </div>
  </div>
</template>
