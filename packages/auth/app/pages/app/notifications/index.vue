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
  unreadCount,
  preferences,
  fetchPreferences,
  updatePreferences
} = useNotificationManagement()

const filter = ref('all')
const page = ref(1)
const showPreferences = ref(false)
const savingPrefs = ref(false)

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

const handleTogglePreferences = () => {
  showPreferences.value = !showPreferences.value
  if (showPreferences.value && preferences.value.length === 0) {
    fetchPreferences()
  }
}

const handlePreferenceToggle = async (prefEvent: string, channel: 'inApp' | 'email', value: boolean) => {
  savingPrefs.value = true
  try {
    await updatePreferences([{ event: prefEvent, [channel]: value }])
  } catch {
    await fetchPreferences()
  } finally {
    savingPrefs.value = false
  }
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
    <div class="flex items-center justify-between mb-8" data-tour="notifications-step-0">
      <div>
        <h1 class="text-3xl font-bold mb-2">{{ t('heading') }}</h1>
        <p class="text-muted-foreground">{{ t('subheading') }}</p>
      </div>

      <div class="flex items-center gap-2">
        <UButton variant="ghost" icon="i-lucide-settings-2" @click="handleTogglePreferences">
          {{ t('preferences.toggle') }}
        </UButton>
        <UButton v-if="unreadCount > 0" variant="outline" icon="i-lucide-check-check" @click="handleMarkAllRead">
          {{ t('actions.markAllRead') }}
        </UButton>
      </div>
    </div>

    <UCard v-if="showPreferences" class="mb-6">
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">{{ t('preferences.title') }}</h2>
          <p class="text-sm text-muted-foreground">{{ t('preferences.description') }}</p>
        </div>
      </template>
      <div class="divide-y divide-default">
        <div v-for="pref in preferences" :key="pref.event" class="flex items-center justify-between gap-4 py-3">
          <div>
            <p class="text-sm font-medium">{{ t(`preferences.events.${pref.event}`) }}</p>
            <p class="text-xs text-muted-foreground">{{ pref.event }}</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">{{ t('preferences.inApp') }}</span>
              <USwitch :model-value="pref.inApp" :disabled="savingPrefs"
                @update:model-value="(v: boolean) => handlePreferenceToggle(pref.event, 'inApp', v)" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">{{ t('preferences.email') }}</span>
              <USwitch :model-value="pref.email" :disabled="savingPrefs"
                @update:model-value="(v: boolean) => handlePreferenceToggle(pref.event, 'email', v)" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <p class="text-xs text-muted-foreground">{{ t('preferences.emailSoon') }}</p>
      </template>
    </UCard>

    <UTabs :items="items" v-model="filter" class="w-full" data-tour="notifications-step-1">
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
