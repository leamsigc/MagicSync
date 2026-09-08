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
  dmAccounts,
  conversations,
  dmLoading,
  dmError,
  fetchDmAccounts,
  fetchConversations,
  replyToConversation,
} = useInbox()

const activeTab = ref<'comment' | 'dm' | 'notification'>('comment')
const selectedPlatform = ref<string | undefined>(undefined)
const showUnreadOnly = ref(false)
const replyingTo = ref<string | null>(null)
const replyText = ref('')
const showDeleteConfirm = ref<string | null>(null)
const selectedDmAccount = ref<string | undefined>(undefined)
const replyingConvo = ref<string | null>(null)
const dmReplyText = ref('')
const dmSentId = ref<string | null>(null)

const dmAccountOptions = computed(() => [
  { label: t('dm_select_account'), value: undefined },
  ...dmAccounts.value.map((a) => ({ label: a.accountName, value: a.id })),
])

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

const tabItems = computed(() => [
  {
    label: t('tabs_comments'),
    value: 'comment',
    badge: unreadCount.value > 0 ? unreadCount.value : undefined,
  },
  { label: t('tabs_messages'), value: 'dm' },
  { label: t('tabs_notifications'), value: 'notification' },
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
  if (tab === 'dm') {
    handleDmTabOpen()
    return
  }
  setFilters({ type: tab })
}

const handleDmTabOpen = async () => {
  await fetchDmAccounts()
  const first = dmAccounts.value[0]
  if (first && !selectedDmAccount.value) {
    handleDmAccountChange(first.id)
  }
}

const handleDmAccountChange = (accountId: string | { label?: string; value?: string } | undefined) => {
  // USelect may emit the whole option object — normalize to the id string.
  const id = typeof accountId === 'string' ? accountId : accountId?.value
  selectedDmAccount.value = id
  dmSentId.value = null
  if (id) {
    fetchConversations(id)
  }
}

const handleDmReplyStart = (id: string) => {
  replyingConvo.value = id
  dmReplyText.value = ''
  dmSentId.value = null
}

const handleDmReplyCancel = () => {
  replyingConvo.value = null
}

const handleDmReplySend = async (conversationId: string) => {
  if (!selectedDmAccount.value || !dmReplyText.value.trim()) return
  try {
    await replyToConversation(selectedDmAccount.value, conversationId, dmReplyText.value.trim())
    replyingConvo.value = null
    dmReplyText.value = ''
    dmSentId.value = conversationId
  } catch {
    // Error surfaced via dmError
  }
}

const handlePlatformChange = (platform: string | { label?: string; value?: string } | undefined) => {
  const value = typeof platform === 'string' ? platform : platform?.value
  selectedPlatform.value = value
  setFilters({ platform: value })
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

const handleDmRetry = () => {
  if (selectedDmAccount.value) {
    fetchConversations(selectedDmAccount.value)
  } else {
    handleDmTabOpen()
  }
}

const convoParticipantNames = (convo: { participants?: { name?: string }[] }) => {
  const names = (convo.participants || []).map((p) => p.name).filter(Boolean)
  return names.length > 0 ? names.join(', ') : t('dm_unknown')
}

onMounted(() => {
  fetchInbox({ type: 'comment' })
  fetchUnreadCount()
})
</script>

<template>
  <UContainer class="py-8 max-w-6xl">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold mb-2">{{ t('title') }}</h1>
        <p class="text-muted-foreground">{{ t('description') }}</p>
      </div>
      <UButton
        v-if="unreadCount > 0"
        variant="outline"
        icon="i-lucide-check-check"
        @click="handleMarkAllRead"
      >
        {{ t('mark_all_read') }}
      </UButton>
    </div>

    <UTabs :items="tabItems" :model-value="activeTab" class="w-full" @update:model-value="handleTabChange" />

    <div v-if="activeTab === 'dm'" class="mt-6 space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <USelectMenu
          :model-value="selectedDmAccount"
          :items="dmAccountOptions"
          :placeholder="t('dm_select_account')"
          class="w-64"
          @update:model-value="handleDmAccountChange"
        />
      </div>
      <p class="text-xs text-muted-foreground">{{ t('dm_window_note') }}</p>

      <div v-if="dmLoading" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <div
        v-else-if="dmError"
        class="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20"
      >
        <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto h-8 w-8 text-red-400" />
        <p class="mt-2 text-sm text-red-600 dark:text-red-400">{{ dmError }}</p>
        <UButton
          :label="t('retry')"
          color="error"
          variant="soft"
          class="mt-4"
          @click="handleDmRetry"
        />
      </div>

      <div
        v-else-if="dmAccounts.length === 0"
        class="rounded-lg bg-muted/50 p-12 text-center"
      >
        <UIcon
          name="i-heroicons-chat-bubble-left-right"
          class="mx-auto h-12 w-12 text-muted-foreground"
        />
        <p class="mt-4 text-sm font-medium">{{ t('dm_no_accounts_title') }}</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('dm_no_accounts_hint') }}</p>
      </div>

      <div
        v-else-if="conversations.length === 0"
        class="rounded-lg bg-muted/50 p-12 text-center"
      >
        <UIcon
          name="i-heroicons-inbox"
          class="mx-auto h-12 w-12 text-muted-foreground"
        />
        <p class="mt-4 text-sm text-muted-foreground">{{ t('dm_empty_conversations') }}</p>
      </div>

      <UCard v-else>
        <div class="divide-y divide-default">
          <div
            v-for="convo in conversations"
            :key="convo.id"
            class="flex items-start justify-between gap-4 py-3"
          >
            <div class="flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium">
                  {{ convoParticipantNames(convo) }}
                </span>
                <UBadge
                  v-if="convo.unreadCount"
                  color="error"
                  variant="subtle"
                  size="xs"
                >
                  {{ convo.unreadCount }}
                </UBadge>
                <span
                  v-if="convo.messageCount"
                  class="text-xs text-muted-foreground"
                >
                  {{ t('dm_messages_count', { count: convo.messageCount }) }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ convo.updatedTime ? timeAgo(new Date(convo.updatedTime)) : '—' }}
                </span>
              </div>

              <p v-if="convo.snippet" class="mt-2 text-sm text-muted-foreground">
                {{ convo.snippet }}
              </p>

              <p v-if="dmSentId === convo.id" class="mt-2 text-sm text-green-600 dark:text-green-400">
                {{ t('dm_sent_confirm') }}
              </p>

              <div v-if="replyingConvo === convo.id" class="mt-4">
                <UTextarea
                  v-model="dmReplyText"
                  :placeholder="t('dm_reply_placeholder')"
                  :rows="2"
                  class="w-full"
                />
                <div class="mt-2 flex justify-end gap-2">
                  <UButton
                    :label="t('cancel')"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    @click="handleDmReplyCancel"
                  />
                  <UButton
                    :label="t('send')"
                    color="primary"
                    size="sm"
                    :disabled="!dmReplyText.trim()"
                    @click="handleDmReplySend(convo.id)"
                  />
                </div>
              </div>
            </div>

            <div class="ml-4 flex items-center gap-2">
              <UButton
                icon="i-heroicons-chat-bubble-left"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="handleDmReplyStart(convo.id)"
              />
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="activeTab !== 'dm'" class="mt-6">
      <div class="mb-6 flex flex-wrap items-center gap-2">
        <USelectMenu
          :model-value="selectedPlatform"
          :items="platformOptions"
          :placeholder="t('filter_all_platforms')"
          class="w-48"
          @update:model-value="handlePlatformChange"
        />
        <UButton
          :label="showUnreadOnly ? t('show_all') : t('show_unread')"
          :color="showUnreadOnly ? 'primary' : 'neutral'"
          variant="soft"
          @click="handleToggleUnread"
        />
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <div
        v-else-if="error"
        class="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20"
      >
        <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto h-8 w-8 text-red-400" />
        <p class="mt-2 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <UButton
          :label="t('retry')"
          color="error"
          variant="soft"
          class="mt-4"
          @click="fetchInbox({ type: activeTab })"
        />
      </div>

      <div
        v-else-if="filteredItems.length === 0"
        class="rounded-lg bg-muted/50 p-12 text-center"
      >
        <UIcon
          name="i-heroicons-inbox"
          class="mx-auto h-12 w-12 text-muted-foreground"
        />
        <p class="mt-4 text-sm font-medium">{{ t('empty_title') }}</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('empty_description') }}</p>
      </div>

      <UCard v-else>
        <div class="divide-y divide-default">
          <div
            v-for="item in filteredItems"
            :key="item.id"
            class="py-3"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex min-w-0 flex-1 items-start gap-2">
                <span
                  v-if="!item.read"
                  class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                  :title="t('filter_unread')"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-medium">
                      {{ item.authorName || t('unknown_author') }}
                    </span>
                    <span class="text-xs text-muted-foreground">
                      @{{ item.authorId || 'unknown' }}
                    </span>
                    <UBadge color="neutral" variant="subtle" size="xs">
                      {{ platformLabel(item.platform) }}
                    </UBadge>
                    <span class="text-xs text-muted-foreground">
                      {{ timeAgo(item.createdAt) }}
                    </span>
                  </div>

                  <p class="mt-2 text-sm text-muted-foreground">
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
                        color="neutral"
                        variant="soft"
                        size="sm"
                        @click="handleReplyCancel"
                      />
                      <UButton
                        :label="t('send')"
                        color="primary"
                        size="sm"
                        :disabled="!replyText.trim()"
                        @click="handleReplySend(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-1">
                <UButton
                  icon="i-heroicons-chat-bubble-left"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="handleReplyStart(item.id)"
                />
                <UButton
                  icon="i-heroicons-heart"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="handleLike(item)"
                />
                <UButton
                  icon="i-heroicons-eye-slash"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="handleHide(item)"
                />
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
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
                {{ t('confirm_delete') }}
              </p>
              <div class="mt-2 flex justify-end gap-2">
                <UButton
                  :label="t('cancel')"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  @click="handleDeleteCancel"
                />
                <UButton
                  :label="t('delete')"
                  color="error"
                  size="xs"
                  @click="handleDelete(item.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <div v-if="nextCursor" class="flex justify-center pt-4">
        <UButton
          :label="t('load_more')"
          color="neutral"
          variant="soft"
          :loading="isLoading"
          @click="loadMore"
        />
      </div>
    </div>
  </UContainer>
</template>
