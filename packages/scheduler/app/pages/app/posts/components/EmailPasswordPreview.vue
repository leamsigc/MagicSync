<script lang="ts" setup>
/**
 *
 * Email/Password Preview Component
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PostCreateBase, Asset } from '#layers/BaseDB/db/schema';
import type { SocialMediaPlatformConfigurations } from '../composables/usePlatformConfiguration';

const props = defineProps<{
  postContent: string;
  mediaAssets: Asset[];
  platform: keyof SocialMediaPlatformConfigurations | 'default';
  post: PostCreateBase
}>();
</script>

<template>
  <div class="rounded-lg shadow-md p-4 max-w-md mx-auto">
    <div class="flex items-center mb-3">
      <UAvatar src="https://avatars.githubusercontent.com/u/739984?v=4" alt="User" size="md" />
      <div class="ml-3">
        <p class="font-semibold text-gray-900 dark:text-white">User Name</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">Just now</p>
      </div>
    </div>
    <p class="text-gray-800 dark:text-gray-200 mb-3">{{ props.postContent }}</p>
    <div v-if="props.mediaAssets && props.mediaAssets.length > 0" class="grid grid-cols-1 gap-2 mb-3">
      <img v-for="asset in props.mediaAssets" :key="asset.id" :src="asset.url" alt="Post media"
        class="rounded-lg w-full" />
    </div>
    <div v-if="props.postContent.length > 0 || (props.mediaAssets && props.mediaAssets.length > 0)"
      class="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-around text-gray-500 dark:text-gray-400 text-sm">
      <span>Preview for Email/Password</span>
    </div>
    <div v-if="props.post.comment && props.post.comment.length > 0"
      class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      <p class="font-semibold text-gray-900 dark:text-white mb-2">Comments:</p>
      <div v-for="(comment, index) in props.post.comment" :key="index"
        class="text-gray-800 dark:text-gray-200 text-sm mb-1">
        {{ comment }}
      </div>
    </div>
  </div>
</template>

<style scoped></style>
