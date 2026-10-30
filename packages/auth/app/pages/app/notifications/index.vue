<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Notifications page.
 *
 * The markup moved to the shared collection shell (one toolbar with search and
 * a single List view). Mark-as-read / mark-all-read / delete still call the
 * same composable actions, and the preferences card is unchanged.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 */
import type { Notification } from '#layers/BaseDB/db/schema'
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'

const NOTIFICATION_ICONS: Record<string, string> = {
  info: 'i-lucide-info',
  success: 'i-lucide-check-circle',
  warning: 'i-lucide-alert-triangle',
  error: 'i-lucide-x-circle',
}

const NOTIFICATION_TONES: Record<string, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

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
  updatePreferences,
} = useNotificationManagement()

const filter = ref('all')
const page = ref(1)
const showPreferences = ref(false)
const savingPrefs = ref(false)

const { search, setSearch, filtered, hasActiveFilters, resetFilters } = useCollectionView<Notification>({
  key: 'app-notifications',
  modes: ['list'],
  defaultView: 'list',
  rows: notifications,
  searchFields: notification => [notification.title, notification.message],
})

const unreadNotifications = computed(() => filtered.value.filter(notification => !notification.read))

const visibleNotifications = computed(() =>
  filter.value === 'unread' ? unreadNotifications.value : filtered.value
)

const emptyTitle = computed(() =>
  hasActiveFilters.value ? t('noResults') : t('empty.title')
)

const emptyHint = computed(() =>
  hasActiveFilters.value ? '' : t('empty.description')
)

const items = computed(() => [
  { label: t('filters.all'), value: 'all' },
  { label: t('filters.unread'), value: 'unread' },
])

function notificationRowKey(notification: Notification): string {
  return String(notification.id)
}

function notificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.info
}

function notificationTone(type: string): string {
  return NOTIFICATION_TONES[type] || NOTIFICATION_TONES.info
}

function timeAgo(value: string | Date): string {
  const date = new Date(value)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return t('time.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('time.daysAgo', { count: days })
}

// Fetch on mount
onMounted(() => {
  fetchNotifications()
})

// Watch filter changes
watch(filter, () => {
  page.value = 1
  fetchNotifications({ unreadOnly: filter.value === 'unread' })
})

function handleMarkRead(id: number) {
  void markAsRead(id)
}

function handleDelete(id: number) {
  void deleteNotification(id)
}

function handleMarkAllRead() {
  void markAllAsRead()
}

function handleTogglePreferences() {
  showPreferences.value = !showPreferences.value
  if (showPreferences.value && preferences.value.length === 0) {
    fetchPreferences()
  }
}

async function handlePreferenceToggle(prefEvent: string, channel: 'inApp' | 'email', value: boolean) {
  savingPrefs.value = true
  try {
    await updatePreferences([{ event: prefEvent, [channel]: value }])
  } catch {
    await fetchPreferences()
  } finally {
    savingPrefs.value = false
  }
}

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }],
})
</script>

<template>
  <BaseCollectionPage :title="t('heading')" :description="t('subheading')">
    <template #actions>
      <div class="flex flex-wrap items-center gap-2" data-tour="notifications-step-0">
        <UButton variant="ghost" icon="i-lucide-settings-2" @click="handleTogglePreferences">
          {{ t('preferences.toggle') }}
        </UButton>
        <UButton v-if="unreadCount > 0" variant="outline" icon="i-lucide-check-check" @click="handleMarkAllRead">
          {{ t('actions.markAllRead') }}
        </UButton>
      </div>
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('searchPlaceholder')"
        :busy="loading"
        @update:search="setSearch"
      />
    </template>

    <UCard v-if="showPreferences" class="mb-6">
      <template #header>
        <div>
          <h2 class="text-lg font-semibold">{{ t('preferences.title') }}</h2>
          <p class="text-sm text-muted">{{ t('preferences.description') }}</p>
        </div>
      </template>
      <div class="divide-y divide-default">
        <div v-for="pref in preferences" :key="pref.event" class="flex items-center justify-between gap-4 py-3">
          <div>
            <p class="text-sm font-medium">{{ t(`preferences.events.${pref.event}`) }}</p>
            <p class="text-xs text-muted">{{ pref.event }}</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted">{{ t('preferences.inApp') }}</span>
              <USwitch :model-value="pref.inApp" :disabled="savingPrefs"
                @update:model-value="(v: boolean) => handlePreferenceToggle(pref.event, 'inApp', v)" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted">{{ t('preferences.email') }}</span>
              <USwitch :model-value="pref.email" :disabled="savingPrefs"
                @update:model-value="(v: boolean) => handlePreferenceToggle(pref.event, 'email', v)" />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <p class="text-xs text-muted">{{ t('preferences.emailSoon') }}</p>
      </template>
    </UCard>

    <UTabs v-model="filter" :items="items" :content="false" class="w-full" data-tour="notifications-step-1" />

    <BaseCollectionList
      class="mt-6"
      :items="visibleNotifications"
      :row-key="notificationRowKey"
      :loading="loading"
      :empty-title="emptyTitle"
      :empty-hint="emptyHint"
      empty-icon="i-lucide-bell-off"
    >
      <template #item="{ item: notification }">
        <UIcon :name="notificationIcon(notification.type)" class="mt-0.5 size-5 shrink-0"
          :class="notificationTone(notification.type)" />

        <div class="min-w-0 flex-1">
          <div class="mb-1 flex items-center justify-between gap-2">
            <p class="truncate text-sm leading-none" :class="notification.read ? 'text-muted' : 'font-medium text-highlighted'">
              {{ notification.title }}
            </p>
            <span class="shrink-0 whitespace-nowrap text-xs text-muted">{{ timeAgo(notification.createdAt) }}</span>
          </div>
          <p v-if="notification.message" class="line-clamp-2 text-sm text-muted">
            {{ notification.message }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <UTooltip v-if="!notification.read" :text="t('actions.markAsRead')">
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-check"
              :aria-label="t('actions.markAsRead')" @click="() => handleMarkRead(notification.id)" />
          </UTooltip>
          <UTooltip :text="t('actions.delete')">
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2"
              :aria-label="t('actions.delete')" @click="() => handleDelete(notification.id)" />
          </UTooltip>
        </div>
      </template>

      <template #empty>
        <UButton v-if="hasActiveFilters" variant="ghost" icon="i-lucide-filter-x" @click="resetFilters">
          {{ t('clearFilters') }}
        </UButton>
      </template>
    </BaseCollectionList>
  </BaseCollectionPage>
</template>
