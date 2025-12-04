<script lang="ts" setup>
/**
 *
 * Twitter Preview Component
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PostCreateBase, Asset, User } from '#layers/BaseDB/db/schema';
import type { SocialMediaPlatformConfigurations } from '../composables/usePlatformConfiguration';
import dayjs from 'dayjs';

const user = useState<User | null>('auth:user')

const props = defineProps<{
  postContent: string;
  mediaAssets: Asset[];
  platform: keyof SocialMediaPlatformConfigurations | 'default';
  post: PostCreateBase
}>();

const date = dayjs(Date.now()).format('hh:mm A · MMM D, YYYY');// 3:47 PM · Nov 14, 2025 ·
</script>

<template>
  <div class=" text-white p-4 max-w-md mx-auto font-twitter">
    <!-- Header -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center">
        <UAvatar src="https://avatars.githubusercontent.com/u/739984?v=4" alt="User" size="md" class="mr-3" />
        <div>
          <div class="flex items-center">
            <p class="font-bold text-white">{{ user?.name }}</p>
            <UIcon name="i-heroicons-check-badge-solid" class="text-blue-500 ml-1" />
          </div>
          <p class="text-gray-500 text-sm">@{{ user?.name.replace(' ', '_') }}</p>
        </div>
      </div>
      <UIcon name="i-heroicons-arrow-path" class="text-gray-500 text-xl" />
    </div>

    <!-- Post Content -->
    <p class="text-white mb-3 leading-relaxed">{{ props.postContent }}</p>

    <!-- Embedded Post/Card -->
    <div v-if="props.mediaAssets && props.mediaAssets.length > 0" class="grid grid-cols-1 gap-2 mb-2">
      <img v-for="asset in props.mediaAssets" :key="asset.id" :src="asset.url" alt="Post media"
        class="w-full rounded-lg" />
    </div>

    <!-- Post Footer (Date and Views) -->
    <p class="text-gray-500 text-xs mb-3">{{ date }} ·
      <span class="font-bold text-white">1000.6K</span> Views
    </p>

    <!-- Actions -->
    <div class="flex justify-around text-gray-500 text-sm border-t border-gray-700 pt-3 mb-3">
      <div class="flex items-center">
        <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="mr-1" />
        <span>{{ post.comment.length }}</span>
      </div>
      <div class="flex items-center">
        <UIcon name="i-heroicons-arrow-path" class="mr-1" />
        <span>300.2K</span>
      </div>
      <div class="flex items-center">
        <UIcon name="i-heroicons-heart" class="mr-1" />
        <span>30K</span>
      </div>
      <div class="flex items-center">
        <UIcon name="i-heroicons-bookmark" class="mr-1" />
        <span>758</span>
      </div>
      <UIcon name="i-heroicons-arrow-up-tray" />
    </div>

    <!-- Who can reply section -->
    <div class="bg-gray-900 rounded-lg p-3 flex items-center text-blue-500 text-sm mb-4">
      <UIcon name="i-heroicons-user-circle" class="mr-2 text-xl" />
      <span>Who can reply? <span class="text-gray-500">Accounts @mehdirhasan follows or mentioned can
          reply</span></span>
    </div>

    <!-- Comments Section -->
    <div v-if="props.post.comment && props.post.comment.length > 0" class="">
      <div v-for="(comment, index) in props.post.comment" :key="index"
        class="flex items-start mb-3 border-t border-gray-700 pt-3">
        <UAvatar src="https://avatars.githubusercontent.com/u/739984?v=4" alt="Commenter" size="sm" class="mr-3" />
        <div>
          <div class="flex items-center">
            <p class="font-bold text-white text-sm">{{ user?.name }}</p>
            <p class="text-gray-500 text-xs ml-1">{{ user?.name.replace(' ', '_') }}· 1m</p>
          </div>
          <p class="text-gray-200 text-sm">{{ comment }}</p>
          <div class="flex items-center text-gray-500 text-xs mt-1">
            <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="mr-1" />
            <span>30</span>
            <UIcon name="i-heroicons-arrow-path" class="ml-3 mr-1" />
            <span>100K</span>
            <UIcon name="i-heroicons-heart" class="ml-3 mr-1" />
            <span>150K</span>
            <UIcon name="i-heroicons-chart-bar" class="ml-3 mr-1" />
            <UIcon name="i-heroicons-bookmark" class="ml-3 mr-1" />
            <UIcon name="i-heroicons-arrow-up-tray" class="ml-3" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
