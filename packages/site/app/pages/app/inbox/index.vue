<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Unified inbox page for managing comments, messages, and notifications
 * from all connected social media platforms.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import { computed, ref } from 'vue'
import { useInbox } from '~/composables/useInbox'
import type { InboxItem } from '#layers/BaseDB/db/inbox/inbox'

const { t } = useI18n()
const {
  inboxItems,
  unreadCount,
  isLoading,
  error,
  nextCursor,
  fetchInbox,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  archiveItems,
  loadMore,
  setFilters,
} = useInbox()

const activeTab = ref<'comment' | 'dm' | 'notification'>('comment')
const selectedPlatform = ref<string | undefined>(undefined)
const showUnreadOnly = ref(false)
const replyingTo = ref<string | null>(null)
const replyText = ref('')
const showDeleteConfirm = ref<string | null>(null)

const platformOptions = computed(() => [
  { label: t('filter_all_platforms'), value: undefined },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Twitter/X', value: 'twitter' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Bluesky', value: 'bluesky' },
  { label: 'Threads', value: 'threads' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Mastodon', value: 'mastodon' },
])

const tabs = computed(() => [
  { key: 'comment' as const, label: t('tabs_comments'), count: unreadCount.value },
  { key: 'dm' as const, label: t('tabs_messages'), count: 0 },
  { key: 'notification' as const, label: t('tabs_notifications'), count: 0 },
])

const filteredItems = computed(() => {
  return inboxItems.value.filter((item) => {
    if (item.type !== activeTab.value) return false
    if (selectedPlatform.value && item.platform !== selectedPlatform.value) return false
    if (showUnreadOnly.value && item.read) return false
    return true
  })
})

const platformLabel = (platform: string) => {
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

const timeAgo = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return t('just_now')
  if (minutes < 60) return t('minutes_ago', { count: minutes })
  if (hours < 24) return t('hours_ago', { count: hours })
  return t('days_ago', { count: days })
}

const handleTabChange = (tab: 'comment' | 'dm' | 'notification') => {
  activeTab.value = tab
  setFilters({ type: tab })
}

const handlePlatformChange = (platform: string | undefined) => {
  selectedPlatform.value = platform
  setFilters({ platform })
}

const handleToggleUnread = () => {
  showUnreadOnly.value = !showUnreadOnly.value
  setFilters({ read: showUnreadOnly.value ? false : undefined })
}

const handleMarkAllRead = () => {
  markAllAsRead({ platform: selectedPlatform.value, type: activeTab.value })
}

const handleArchive = (ids: string[]) => {
  archiveItems(ids)
}

const handleReplyStart = (id: string) => {
  replyingTo.value = id
  replyText.value = ''
}

const handleReplyCancel = () => {
  replyingTo.value = null
}

const handleDeleteAsk = (id: string) => {
  showDeleteConfirm.value = id
}

const handleDeleteCancel = () => {
  showDeleteConfirm.value = null
}

const handleReplySend = async (item: InboxItem) => {
  try {
    await $fetch(`/api/v1/posts/${item.postId}/comments/${item.platform}/reply`, {
      method: 'POST',
      body: { commentId: item.id, replyText: replyText.value },
    })
    replyingTo.value = null
    replyText.value = ''
  } catch {
    // Error handled by toast
  }
}

const handleLike = async (item: InboxItem) => {
  try {
    await $fetch(`/api/v1/posts/${item.postId}/comments/${item.platform}/like`, {
      method: 'POST',
      body: { commentId: item.id },
    })
  } catch {
    // Error handled by toast
  }
}

const handleHide = async (item: InboxItem) => {
  try {
    await $fetch(`/api/v1/posts/${item.postId}/comments/${item.platform}/hide`, {
      method: 'POST',
      body: { commentId: item.id, isHidden: true },
    })
  } catch {
    // Error handled by toast
  }
}

const handleDelete = async (id: string) => {
  try {
    const item = inboxItems.value.find((i) => i.id === id)
    if (!item) return
    await $fetch(`/api/v1/posts/${item.postId}/comments/${item.platform}/delete`, {
      method: 'POST',
      body: { commentId: id },
    })
    inboxItems.value = inboxItems.value.filter((i) => i.id !== id)
    showDeleteConfirm.value = null
  } catch {
    // Error handled by toast
  }
}

const handleMarkRead = (ids: string[]) => {
  markAsRead(ids)
}

onMounted(() => {
  fetchInbox({ type: 'comment' })
  fetchUnreadCount()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('title') }}
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('subtitle') }}
          </p>
        </div>
        <UButton
          :label="t('mark_all_read')"
          color="primary"
          variant="soft"
          :disabled="unreadCount === 0"
          @click="handleMarkAllRead"
        />
      </div>

      <div class="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav class="-mb-px flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="[
              'border-b-2 px-1 py-4 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
            ]"
            @click="handleTabChange(tab.key)"
          >
            {{ tab.label }}
            <span
              v-if="tab.count > 0"
              class="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
            >
              {{ tab.count }}
            </span>
          </button>
        </nav>
      </div>

      <div class="mb-6 flex flex-wrap items-center gap-4">
        <USelect
          :model-value="selectedPlatform"
          :items="platformOptions"
          :placeholder="t('filter_platform')"
          class="w-48"
          @update:model-value="handlePlatformChange"
        />
        <UButton
          :label="showUnreadOnly ? t('show_all') : t('show_unread')"
          :color="showUnreadOnly ? 'primary' : 'gray'"
          variant="soft"
          @click="handleToggleUnread"
        />
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-gray-400" />
      </div>

      <div
        v-else-if="error"
        class="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20"
      >
        <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto h-8 w-8 text-red-400" />
        <p class="mt-2 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <UButton
          :label="t('retry')"
          color="red"
          variant="soft"
          class="mt-4"
          @click="fetchInbox({ type: activeTab })"
        />
      </div>

      <div
        v-else-if="filteredItems.length === 0"
        class="rounded-lg bg-gray-50 p-12 text-center dark:bg-gray-800"
      >
        <UIcon
          name="i-heroicons-inbox"
          class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
        />
        <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('empty_state') }}</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          :class="[
            'rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800',
            item.read ? 'border-gray-200 dark:border-gray-700' : 'border-primary-200 bg-primary-50/30 dark:border-primary-800 dark:bg-primary-900/10',
          ]"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ item.authorName || t('unknown_author') }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  @{{ item.authorId || 'unknown' }}
                </span>
                <span
                  class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {{ platformLabel(item.platform) }}
                </span>
                <span class="text-xs text-gray-400 dark:text-gray-500">
                  {{ timeAgo(item.createdAt) }}
                </span>
              </div>

              <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {{ item.content }}
              </p>

              <div v-if="replyingTo === item.id" class="mt-4">
                <UTextarea
                  v-model="replyText"
                  :placeholder="t('reply_placeholder')"
                  :rows="2"
                  class="w-full"
                />
                <div class="mt-2 flex justify-end gap-2">
                  <UButton
                    :label="t('cancel')"
                    color="gray"
                    variant="soft"
                    size="sm"
                    @click="handleReplyCancel"
                  />
                  <UButton
                    :label="t('send_reply')"
                    color="primary"
                    size="sm"
                    :disabled="!replyText.trim()"
                    @click="handleReplySend(item)"
                  />
                </div>
              </div>
            </div>

            <div class="ml-4 flex items-center gap-2">
              <UButton
                icon="i-heroicons-chat-bubble-left"
                color="gray"
                variant="ghost"
                size="xs"
                @click="handleReplyStart(item.id)"
              />
              <UButton
                icon="i-heroicons-heart"
                color="gray"
                variant="ghost"
                size="xs"
                @click="handleLike(item)"
              />
              <UButton
                icon="i-heroicons-eye-slash"
                color="gray"
                variant="ghost"
                size="xs"
                @click="handleHide(item)"
              />
              <UButton
                icon="i-heroicons-trash"
                color="red"
                variant="ghost"
                size="xs"
                @click="handleDeleteAsk(item.id)"
              />
            </div>
          </div>

          <div
            v-if="showDeleteConfirm === item.id"
            class="mt-4 rounded-md bg-red-50 p-3 dark:bg-red-900/20"
          >
            <p class="text-sm text-red-700 dark:text-red-300">
              {{ t('delete_confirm') }}
            </p>
            <div class="mt-2 flex justify-end gap-2">
              <UButton
                :label="t('cancel')"
                color="gray"
                variant="soft"
                size="xs"
                @click="handleDeleteCancel"
              />
              <UButton
                :label="t('delete')"
                color="red"
                size="xs"
                @click="handleDelete(item.id)"
              />
            </div>
          </div>
        </div>

        <div v-if="nextCursor" class="flex justify-center pt-4">
          <UButton
            :label="t('load_more')"
            color="gray"
            variant="soft"
            :loading="isLoading"
            @click="loadMore"
          />
        </div>
      </div>
    </div>
  </div>
</template>
