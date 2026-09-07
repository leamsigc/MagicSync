import { useState } from 'vue'
import type { InboxItem } from '#layers/BaseDB/db/inbox/inbox'

export interface InboxFilters {
  platform?: string
  type?: 'comment' | 'dm' | 'notification'
  postId?: string
  read?: boolean
  archived?: boolean
  limit?: number
  cursor?: string
}

export function useInbox() {
  const inboxItems = useState<InboxItem[]>('inbox-items', () => [])
  const unreadCount = useState<number>('inbox-unread-count', () => 0)
  const isLoading = useState<boolean>('inbox-loading', () => false)
  const error = useState<string | null>('inbox-error', () => null)
  const nextCursor = useState<string | undefined>('inbox-next-cursor', () => undefined)
  const filters = useState<InboxFilters>('inbox-filters', () => ({}))

  async function fetchInbox(params: InboxFilters = {}) {
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<{ success: boolean; data: { items: InboxItem[], unreadCount: number, nextCursor?: string } }>('/api/v1/inbox', {
        query: { ...filters.value, ...params },
      })
      if (response.success) {
        inboxItems.value = response.data.items
        unreadCount.value = response.data.unreadCount
        nextCursor.value = response.data.nextCursor
      }
    } catch (err) {
      error.value = String(err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const response = await $fetch<{ success: boolean; data: { count: number } }>('/api/v1/inbox/count')
      if (response.success) {
        unreadCount.value = response.data.count
      }
    } catch (err) {
      error.value = String(err)
    }
  }

  async function markAsRead(ids: string[]) {
    try {
      await $fetch('/api/v1/inbox/read', {
        method: 'POST',
        body: { ids },
      })
      inboxItems.value = inboxItems.value.map((item) =>
        ids.includes(item.id) ? { ...item, read: true } : item
      )
      if (unreadCount.value > 0) {
        unreadCount.value = Math.max(0, unreadCount.value - ids.length)
      }
    } catch (err) {
      error.value = String(err)
    }
  }

  async function markAllAsRead(params: { platform?: string; type?: string } = {}) {
    try {
      await $fetch('/api/v1/inbox/mark-all-read', {
        method: 'POST',
        body: params,
      })
      inboxItems.value = inboxItems.value.map((item) => ({ ...item, read: true }))
      unreadCount.value = 0
    } catch (err) {
      error.value = String(err)
    }
  }

  async function archiveItems(ids: string[]) {
    try {
      await $fetch('/api/v1/inbox/archive', {
        method: 'POST',
        body: { ids },
      })
      inboxItems.value = inboxItems.value.filter((item) => !ids.includes(item.id))
    } catch (err) {
      error.value = String(err)
    }
  }

  async function loadMore() {
    if (!nextCursor.value) return
    isLoading.value = true
    error.value = null
    try {
      const response = await $fetch<{ success: boolean; data: { items: InboxItem[], unreadCount: number, nextCursor?: string } }>('/api/v1/inbox', {
        query: { ...filters.value, cursor: nextCursor.value },
      })
      if (response.success) {
        inboxItems.value = [...inboxItems.value, ...response.data.items]
        nextCursor.value = response.data.nextCursor
      }
    } catch (err) {
      error.value = String(err)
    } finally {
      isLoading.value = false
    }
  }

  function setFilters(newFilters: InboxFilters) {
    filters.value = { ...filters.value, ...newFilters }
    fetchInbox()
  }

  return {
    inboxItems,
    unreadCount,
    isLoading,
    error,
    nextCursor,
    filters,
    fetchInbox,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    archiveItems,
    loadMore,
    setFilters,
  }
}
