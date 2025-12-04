<script lang="ts" setup>
/**
 *
 * Facebook Preview Component
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Asset, PostCreateBase, User } from '#layers/BaseDB/db/schema';
import type { SocialMediaPlatformConfigurations } from '../composables/usePlatformConfiguration';
import dayjs from 'dayjs';


const user = useState<User | null>('auth:user')
const props = defineProps<{
  postContent: string;
  mediaAssets: Asset[];
  platform: keyof SocialMediaPlatformConfigurations | 'default';
  post: PostCreateBase
}>();

const formattedPostDate = computed(() => {
  const postDateTime = dayjs().subtract(1, 'day').hour(12).minute(49);
  return `Today at ${postDateTime.format('hh:mm A')}`;
});
</script>

<template>
  <div class=" rounded-lg shadow-md p-4 max-w-md mx-auto">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center">
        <UAvatar :src="user?.image || ''" :alt="user?.name" size="md" />
        <div class="ml-3">
          <p class="font-semibold text-gray-900 dark:text-white">{{ user?.name }} <span
              class="text-blue-500 ml-1 text-sm">●</span> <span class="text-blue-500 ml-1 text-sm">Follow</span></p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ formattedPostDate }} ·
            <UIcon name="i-heroicons-globe" class="text-gray-500 dark:text-gray-400" />
          </p>
        </div>
      </div>
      <UButton icon="i-heroicons-x-mark" variant="ghost" color="neutral" />
    </div>
    <p class="text-gray-800 dark:text-gray-200 mb-3 whitespace-break-spaces">{{ props.postContent }}</p>
    <div v-if="props.mediaAssets && props.mediaAssets.length > 0 && props.mediaAssets[0]"
      class="relative mb-3 grid grid-cols-2 gap-1">
      <img :src="image.url" alt="Post media" class="rounded-lg w-full h-auto  aspect-square object-cover"
        v-for="(image, index) in mediaAssets" :key="image.id" :class="{ 'row-span-2': index === 0 }" />
    </div>
    <div class="flex items-center justify-between text-gray-500 dark:text-gray-400 text-sm mb-3">
      <div class="flex items-center">
        <span class="mr-1">😡</span><span class="mr-1">😢</span><span class="mr-1">👍</span>
        <span>17K</span>
      </div>
      <div class="flex items-center">
        <span class="mr-2">{{ post.comment.length }} comments</span>
        <span>7.7K shares</span>
      </div>
    </div>
    <div
      class="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-around text-gray-500 dark:text-gray-400 text-sm">
      <UButton icon="i-heroicons-hand-thumb-up" variant="ghost" color="neutral">Like</UButton>
      <UButton icon="i-heroicons-chat-bubble-left" variant="ghost" color="neutral">Comment</UButton>
      <UButton icon="i-heroicons-share" variant="ghost" color="neutral">Share</UButton>
    </div>
    <div v-if="props.post.comment && props.post.comment.length > 0"
      class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      <div class="flex items-center justify-between mb-3">
        <p class="font-semibold text-gray-900 dark:text-white">Most relevant</p>
        <UIcon name="i-heroicons-chevron-down" class="text-gray-500 dark:text-gray-400" />
      </div>
      <div v-for="(comment, index) in props.post.comment" :key="index" class="flex items-start mb-3">
        <UAvatar :src="user?.image || ''" :alt="user?.name" size="sm" />
        <div class="ml-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
          <p class="font-semibold text-gray-900 dark:text-white text-sm">{{ user?.name }}</p>
          <p class="text-gray-800 dark:text-gray-200 text-sm">{{ comment }}</p>
          <div class="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span class="mr-2">1h</span>
            <span class="mr-2">Like</span>
            <span>Reply</span>
            <span class="ml-auto flex items-center">👍 25</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
