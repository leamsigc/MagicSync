<script lang="ts" setup>
/**
 * Component Description: Post Card for the Twitter-like interface
 * display user avatar, name, handle, timestamp, content, and action buttons
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

interface Props {
  id: string;
  avatar: string;
  name: string;
  handle: string;
  timestamp: string;
  content: string;
  comments?: string[];
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
}

const props = withDefaults(defineProps<Props>(), {
  comments: () => [],
  likes: 0,
  retweets: 0,
  replies: 0,
  views: 0
});

const emit = defineEmits<{
  (e: 'open', id: string): void;
  (e: 'view', id: string): void;
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
}>();

const showComments = ref(false);

const menuItems = [
  {
    label: 'View Post',
    icon: 'i-heroicons-eye',
    click: () => emit('view', props.id)
  },
  {
    label: 'Edit Post',
    icon: 'i-heroicons-pencil-square',
    click: () => emit('edit', props.id)
  },
  {
    label: 'Delete Post',
    icon: 'i-heroicons-trash',
    color: 'error' as const,
    click: () => emit('delete', props.id)
  }
];

const toggleComments = () => {
  showComments.value = !showComments.value;
};
</script>

<template>
  <div
    class="border-b border-gray-200 dark:border-zinc-800 p-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
    @click="$emit('open', id)">
    <div class="flex gap-3">
      <!-- Avatar -->
      <UAvatar :src="avatar" :alt="name" size="md" class="shrink-0" />

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <!-- Header -->
        <div class="flex items-center gap-1 text-sm mb-1">
          <span class="font-bold text-gray-900 dark:text-white truncate">{{ name }}</span>
          <span class="text-gray-500 dark:text-gray-400 truncate">{{ handle }}</span>
          <span class="text-gray-500 dark:text-gray-400">·</span>
          <span class="text-gray-500 dark:text-gray-400 hover:underline">{{ timestamp }}</span>
          <div class="ml-auto">
            <UDropdownMenu :items="menuItems" :popper="{ placement: 'bottom-end' }">
              <UButton icon="i-heroicons-ellipsis-horizontal" color="neutral" variant="ghost" size="xs" />
            </UDropdownMenu>
          </div>
        </div>

        <!-- Post Text -->
        <p class="text-gray-900 dark:text-white whitespace-pre-wrap mb-3 text-[15px] leading-normal">
          {{ content }}
        </p>

        <!-- Media Slot -->
        <div v-if="$slots.media" class="mb-3 rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800">
          <slot name="media" />
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between text-gray-500 dark:text-gray-400 max-w-md">
          <UButton icon="i-heroicons-chat-bubble-oval-left" color="neutral" variant="ghost" size="sm"
            :label="String(replies || comments.length)" @click.stop="toggleComments" />
          <UButton icon="i-heroicons-arrow-path-rounded-square" color="neutral" variant="ghost" size="sm"
            :label="String(retweets)" />
          <UButton icon="i-heroicons-heart" color="neutral" variant="ghost" size="sm" :label="String(likes)" />
          <UButton icon="i-heroicons-chart-bar" color="neutral" variant="ghost" size="sm" :label="String(views)" />
          <UButton icon="i-heroicons-arrow-up-tray" color="neutral" variant="ghost" size="sm" />
        </div>

        <!-- Comments Section -->
        <div v-if="showComments && comments.length > 0" class="mt-4 space-y-3">
          <div class="border-t border-gray-200 dark:border-zinc-800 pt-3">
            <div v-for="(comment, index) in comments" :key="index" class="flex gap-3 mb-3 last:mb-0">
              <UAvatar :src="avatar" :alt="name" size="sm" class="shrink-0 opacity-70" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 text-sm">
                  <span class="font-bold text-gray-900 dark:text-white">{{ name }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ handle }}</span>
                  <span class="text-gray-500 dark:text-gray-400">·</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ timestamp }}</span>
                </div>
                <p class="text-gray-900 dark:text-white whitespace-pre-wrap text-[15px] leading-normal mt-1">
                  {{ comment }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
