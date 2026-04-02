<script setup lang="ts">
interface Props {
  threads: Array<{ id: string; title: string; lastMessage: string }>
  activeThreadId?: string
}

defineProps<Props>()
const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  newThread: []
}>()

const threadItems = (threadId: string) => [
  [{
    label: 'Delete',
    icon: 'i-lucide-trash',
    color: 'error' as const,
    onSelect: () => emit('delete', threadId),
  }],
]
</script>

<template>
  <div class="w-64 border-r border-muted bg-elevated flex flex-col">
    <div class="p-3">
      <UButton
        label="New Chat"
        icon="i-lucide-plus"
        color="primary"
        variant="solid"
        class="w-full"
        @click="emit('newThread')"
      />
    </div>
    <div class="overflow-y-auto flex-1">
      <div
        v-for="thread in threads"
        :key="thread.id"
        class="group flex items-center gap-2 p-3 cursor-pointer transition-colors rounded-lg mx-1"
        :class="{
          'bg-primary/10': thread.id === activeThreadId,
          'hover:bg-muted': thread.id !== activeThreadId,
        }"
        @click="emit('select', thread.id)"
      >
        <UIcon name="i-lucide-message-square" class="w-5 h-5 text-muted flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ thread.title }}</p>
          <p class="text-xs text-muted truncate">{{ thread.lastMessage }}</p>
        </div>
        <UDropdownMenu :items="threadItems(thread.id)">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            class="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </UDropdownMenu>
      </div>
      <div v-if="!threads.length" class="p-4 text-center text-muted text-sm">
        No conversations yet
      </div>
    </div>
  </div>
</template>
