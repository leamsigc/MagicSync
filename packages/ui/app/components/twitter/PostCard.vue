<script lang="ts" setup>
/**
 * Component Description: Post Card for the Twitter-like interface
 * display user avatar, name, handle, timestamp, content, and action buttons
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

interface Props {
  avatar: string;
  name: string;
  handle: string;
  timestamp: string;
  content: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
}

withDefaults(defineProps<Props>(), {
  likes: 0,
  retweets: 0,
  replies: 0,
  views: 0
});
</script>

<template>
  <div
    class="border-b border-gray-200 dark:border-zinc-800 p-4 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer">
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
            <UButton icon="i-heroicons-ellipsis-horizontal" color="neutral" variant="ghost" size="xs" />
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
            :label="String(replies)" />
          <UButton icon="i-heroicons-arrow-path-rounded-square" color="neutral" variant="ghost" size="sm"
            :label="String(retweets)" />
          <UButton icon="i-heroicons-heart" color="neutral" variant="ghost" size="sm" :label="String(likes)" />
          <UButton icon="i-heroicons-chart-bar" color="neutral" variant="ghost" size="sm" :label="String(views)" />
          <UButton icon="i-heroicons-arrow-up-tray" color="neutral" variant="ghost" size="sm" />
        </div>
      </div>
    </div>
  </div>
</template>
