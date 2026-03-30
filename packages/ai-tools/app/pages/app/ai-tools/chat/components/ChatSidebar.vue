<script setup lang="ts">
interface Props {
  threads: Array<{ id: string; title: string; lastMessage: string }>
  activeThreadId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  newThread: []
}>()
</script>

<template>
  <div class="w-64 border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
    <div class="p-3">
      <UButton
        label="New Chat"
        icon="i-heroicons-plus"
        color="primary"
        variant="solid"
        class="w-full"
        @click="emit('newThread')"
      />
    </div>
    <div class="overflow-y-auto max-h-[calc(100vh-8rem)]">
      <div
        v-for="thread in threads"
        :key="thread.id"
        class="group flex items-center gap-2 p-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        :class="{
          'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-500': thread.id === activeThreadId
        }"
        @click="emit('select', thread.id)"
      >
        <UIcon name="i-heroicons-chat-bubble-left-right" class="w-5 h-5 text-neutral-400" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ thread.title }}</p>
          <p class="text-xs text-neutral-500 truncate">{{ thread.lastMessage }}</p>
        </div>
        <UButton
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          size="xs"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="emit('delete', thread.id)"
        />
      </div>
      <div v-if="!threads.length" class="p-4 text-center text-neutral-500 text-sm">
        No conversations yet
      </div>
    </div>
  </div>
</template>
