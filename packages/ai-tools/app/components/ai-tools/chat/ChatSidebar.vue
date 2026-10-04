<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
interface Thread {
  id: string
  title: string
  lastMessageAt: string | null
}

const props = defineProps<{
  threads: Thread[]
  activeThreadId: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'new'): void
  (e: 'delete', id: string): void
  (e: 'collapse'): void
}>()

const { t } = useI18n()
const search = ref('')

function handleCollapse() {
  emit('collapse')
}

function handleNew() {
  emit('new')
}

function handleSelect(id: string) {
  emit('select', id)
}

function handleDelete(id: string) {
  emit('delete', id)
}

function formatGroupLabel(date: string | null): string {
  if (!date) return t('history.older')
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return t('history.today')
  if (diff === 1) return t('history.yesterday')
  if (diff < 7) return t('history.last7')
  if (diff < 30) return t('history.last30')
  return t('history.older')
}

const filteredThreads = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return props.threads
  return props.threads.filter(thread => thread.title.toLowerCase().includes(term))
})

const groupedThreads = computed(() => {
  const groups = new Map<string, Thread[]>()
  for (const thread of filteredThreads.value) {
    const label = formatGroupLabel(thread.lastMessageAt)
    const list = groups.get(label) ?? []
    list.push(thread)
    groups.set(label, list)
  }
  // preserve order: Today, Yesterday, Last7, Last30, Older
  const order = [t('history.today'), t('history.yesterday'), t('history.last7'), t('history.last30'), t('history.older')]
  return Array.from(groups.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
})

function threadTitle(thread: Thread): string {
  return thread.title?.trim() || t('history.untitled')
}

function formatTime(date: string | null): string {
  if (!date) return ''
  try {
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>

<template>
  <aside class="flex h-full w-[280px] shrink-0 flex-col border-r border-default bg-muted/20">
    <div class="p-3 space-y-3">
      <div class="flex items-center gap-2">
        <UButton
          class="flex-1"
          icon="i-heroicons-plus"
          color="primary"
          variant="solid"
          size="md"
          @click="handleNew"
        >
          {{ t('newChat') }}
        </UButton>
        <UTooltip :text="t('history.collapse')">
          <UButton
            icon="i-heroicons-bars-3-center-left"
            variant="ghost"
            color="neutral"
            size="md"
            :aria-label="t('history.collapse')"
            @click="handleCollapse"
          />
        </UTooltip>
      </div>
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        :placeholder="t('history.search')"
        size="sm"
        class="w-full"
      />
    </div>

    <div class="flex-1 overflow-y-auto px-2 py-2">
      <div v-if="loading" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-muted" />
      </div>

      <div v-else-if="filteredThreads.length === 0" class="py-8 text-center">
        <UIcon name="i-heroicons-chat-bubble-left-right" class="mx-auto h-8 w-8 text-muted" />
        <p class="mt-2 text-sm text-muted">{{ search ? t('history.noResults') : t('history.empty') }}</p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="[label, items] in groupedThreads" :key="label" class="space-y-1">
          <p class="px-2 text-xs font-semibold uppercase tracking-wide text-muted">{{ label }}</p>
          <div class="space-y-1">
            <div
              v-for="thread in items"
              :key="thread.id"
              class="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-elevated cursor-pointer border border-transparent"
              :class="thread.id === activeThreadId ? 'bg-elevated border-default shadow-sm' : ''"
              @click="handleSelect(thread.id)"
            >
              <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="h-4 w-4 shrink-0 text-muted" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium" :class="thread.id === activeThreadId ? 'text-highlighted' : 'text-default'">{{ threadTitle(thread) }}</p>
                <p class="text-xs text-muted">{{ formatTime(thread.lastMessageAt) }}</p>
              </div>
              <UButton
                icon="i-heroicons-trash"
                variant="ghost"
                color="neutral"
                size="xs"
                class="opacity-0 group-hover:opacity-100"
                :aria-label="t('history.delete')"
                @click.stop="handleDelete(thread.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="border-t border-default p-3">
      <p class="text-xs text-muted text-center">{{ t('history.hint') }}</p>
    </div>
  </aside>
</template>
