<!-- Translation file -->
<i18n src="./feeds.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Single post detail view in Twitter-style layout
 * Displays full post details including content, assets, platform statuses, and metadata
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons';
import dayjs from 'dayjs';
import PostCommentsView from '../components/views/PostCommentsView.vue';
import PostStatsView from '../components/views/PostStatsView.vue';

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const postId = route.params.id as string
const { getPlatformIcon } = usePlatformIcons()
const post = useState<{ success: boolean, data: PostWithAllData } | null>()

const activeTab = ref<'post' | 'details' | 'comments' | 'stats'>('post')

callOnce(async () => {
  console.log('This will only be logged once and then on every client side navigation')
  post.value = await $fetch(`/api/v1/posts/${postId}`)
}, { mode: 'navigation' })


const postData = computed(() => post.value?.data)

const formattedDate = computed(() => {
  if (!postData.value?.createdAt) return ''
  return dayjs(postData.value.createdAt).format('h:mm A · MMM D, YYYY')
})

const scheduledDate = computed(() => {
  if (!postData.value?.scheduledAt) return ''
  return dayjs(postData.value.scheduledAt).format('h:mm A · MMM D, YYYY')
})

const platformStatuses = computed(() => {
  if (!postData.value?.platformPosts) return []
  return postData.value.platformPosts.map(pp => ({
    platform: pp.platformPostId || pp.socialAccountId,
    status: pp.status,
    errorMessage: pp.errorMessage,
    publishedAt: pp.publishedAt,
    publishDetail: pp.publishDetail
  }))
})

const comments = computed(() => {
  const platformContent = postData.value?.platformContent
  if (!platformContent) return []
  //@ts-ignore
  return (postData.value?.platformContent?.comment) as unknown as string[] || []
})

const mediaAssets = computed(() => postData.value?.assets || [])

const goBack = () => {
  router.push('/app/posts/feeds')
}

const showRawData = ref(false)

const toggleRawData = () => {
  showRawData.value = !showRawData.value
}


setPageLayout('auth-twitter-layout')

useHead({
  title: postData.value?.content?.slice(0, 50) + '...' || 'Post Details'
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <div class="sticky top-0 z-50 bg-default/80 backdrop-blur-md border-b border-zinc-800">
      <div class="flex items-center gap-4 px-4 py-3">
        <UButton icon="i-heroicons-arrow-left" color="neutral" variant="ghost" @click="goBack" />
        <span class="text-xl font-bold text-white">{{ t('postDetail.post') }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="!postData" class="flex justify-center items-center py-20">
      <Icon name="i-heroicons-arrow-path" size="lg" class="animate-spin" />
    </div>

    <!-- Tab Navigation -->
    <div class="border-b border-zinc-800 px-4" v-if="postData">
      <nav class="flex gap-1 -mb-px">
        <button
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'post'
            ? 'border-blue-500 text-blue-500'
            : 'border-transparent text-zinc-500 hover:text-zinc-300'"
          @click="activeTab = 'post'"
        >
          {{ t('feeds.tabs.post') }}
        </button>
        <button
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'details'
            ? 'border-blue-500 text-blue-500'
            : 'border-transparent text-zinc-500 hover:text-zinc-300'"
          @click="activeTab = 'details'"
        >
          {{ t('feeds.tabs.details') }}
        </button>
        <button
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1"
          :class="activeTab === 'comments'
            ? 'border-blue-500 text-blue-500'
            : 'border-transparent text-zinc-500 hover:text-zinc-300'"
          @click="activeTab = 'comments'"
        >
          {{ t('feeds.tabs.comments') }}
          <span v-if="postData?.platformPosts?.length > 0"
            class="ml-1 text-xs bg-zinc-700 text-zinc-300 rounded-full px-1.5 py-0.5">
            {{ postData.platformPosts.filter((pp: { status: string }) => pp.status === 'published').length }}
          </span>
        </button>
        <button
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1"
          :class="activeTab === 'stats'
            ? 'border-blue-500 text-blue-500'
            : 'border-transparent text-zinc-500 hover:text-zinc-300'"
          @click="activeTab = 'stats'"
        >
          {{ t('feeds.tabs.stats') }}
        </button>
      </nav>
    </div>

    <!-- Tab: Post Content -->
    <div v-if="activeTab === 'post'">
    <!-- Post Content -->
    <div v-if="postData" class="border-b border-zinc-800">
      <!-- User Header -->
      <div class="p-4">
        <div class="flex gap-3 mb-4">
          <UAvatar :src="postData.user?.image || ''" :alt="postData.user?.name" size="md" class="shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="font-bold text-white truncate">{{ postData.user?.name }}</div>
            <div class="text-zinc-500 truncate">@{{ postData.user?.firstName || postData.user?.email }}</div>
          </div>
        </div>

        <!-- Post Content -->
        <p class="text-white text-xl leading-relaxed mb-4 whitespace-pre-wrap">
          {{ postData.content }}
        </p>

        <!-- Media Grid -->
        <div v-if="mediaAssets.length > 0" class="mb-4">
          <div class="grid gap-2 rounded-2xl overflow-hidden"
            :class="{ 'grid-cols-1': mediaAssets.length === 1, 'grid-cols-2': mediaAssets.length >= 2 }">
            <template v-for="(asset, index) in mediaAssets" :key="index">
              <img v-if="asset.mimeType?.startsWith('image/')" :src="asset.url" :alt="asset.filename"
                class="w-full h-auto object-cover max-h-96 cursor-pointer hover:opacity-90 transition-opacity"
                :class="{ 'col-span-2': mediaAssets.length === 1 }" />
              <video v-else-if="asset.mimeType?.startsWith('video/')" :src="asset.url" controls
                class="w-full h-auto max-h-96" :class="{ 'col-span-2': mediaAssets.length === 1 }"></video>
            </template>
          </div>
        </div>

        <!-- Timestamp -->
        <div class="text-zinc-500 mb-4 flex items-center gap-2">
          <span>{{ formattedDate }}</span>
          <span>·</span>
          <span class="text-zinc-400">{{ postData.status }}</span>
          <span v-if="postData.scheduledAt && postData.status === 'pending'">· Scheduled for {{ scheduledDate }}</span>
        </div>

        <!-- Stats -->
        <div class="border-y border-zinc-800 py-3 flex gap-6">
          <div class="flex items-center gap-1">
            <span class="font-bold text-white">{{ platformStatuses.length }}</span>
            <span class="text-zinc-500">{{ t('postDetail.stats.platforms') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="font-bold text-white">{{ mediaAssets.length }}</span>
            <span class="text-zinc-500">{{ t('postDetail.stats.media') }}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between pt-3">
          <UButton icon="i-heroicons-chat-bubble-oval-left" color="neutral" variant="ghost" size="sm"
            class="text-zinc-500 hover:text-blue-500" @click="activeTab = 'comments'" />
          <UButton icon="i-heroicons-arrow-path-rounded-square" color="neutral" variant="ghost" size="sm"
            class="text-zinc-500 hover:text-green-500" />
          <UButton icon="i-heroicons-heart" color="neutral" variant="ghost" size="sm"
            class="text-zinc-500 hover:text-red-500" />
          <UButton icon="i-heroicons-share" color="neutral" variant="ghost" size="sm"
            class="text-zinc-500 hover:text-blue-500" />
        </div>
      </div>
    </div>
    </div>

    <!-- Tab: Details -->
    <div v-if="activeTab === 'details'">

    <!-- Platform Status Section -->
    <div v-if="platformStatuses.length > 0" class="border-b border-zinc-800 p-4">
      <h3 class="font-bold text-white mb-3">{{ t('postDetail.platformStatus') }}</h3>
      <div class="space-y-3">
        <div v-for="platform in platformStatuses" :key="platform.platform"
          class="flex items-center justify-between bg-zinc-900 rounded-xl p-3">
          <div class="flex items-center gap-3">
            <UIcon :name="getPlatformIcon(platform.platform as any)" class="w-5 h-5 text-zinc-400" />
            <span class="text-white font-medium capitalize">{{ platform.platform }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UBadge
              :color="platform.status === 'published' ? 'success' : platform.status === 'failed' ? 'error' : 'warning'"
              variant="subtle" size="sm">
              {{ platform.status }}
            </UBadge>
            <span v-if="platform.publishedAt" class="text-zinc-500 text-sm">
              {{ dayjs(platform.publishedAt).format('MMM D') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Post Details Section -->
    <div class="border-b border-zinc-800 p-4" v-if="postData">
      <h3 class="font-bold text-white mb-3">{{ t('postDetail.details') }}</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-zinc-500">{{ t('postDetail.fields.postId') }}</span>
          <span class="text-zinc-300 font-mono">{{ postData.id?.slice(0, 16) }}...</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-500">{{ t('postDetail.fields.format') }}</span>
          <span class="text-zinc-300 capitalize">{{ postData.postFormat || 'post' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-zinc-500">{{ t('postDetail.fields.status') }}</span>
          <UBadge
            :color="postData.status === 'published' ? 'success' : postData.status === 'failed' ? 'error' : 'warning'"
            variant="subtle" size="sm">
            {{ postData.status }}
          </UBadge>
        </div>
        <div v-if="postData.publishedAt" class="flex justify-between">
          <span class="text-zinc-500">{{ t('postDetail.fields.published') }}</span>
          <span class="text-zinc-300">{{ dayjs(postData.publishedAt).format('MMM D, YYYY h:mm A') }}</span>
        </div>
        <div v-if="postData.scheduledAt" class="flex justify-between">
          <span class="text-zinc-500">{{ t('postDetail.fields.scheduled') }}</span>
          <span class="text-zinc-300">{{ dayjs(postData.scheduledAt).format('MMM D, YYYY h:mm A') }}</span>
        </div>
      </div>
    </div>

    <!-- Raw Data Toggle Section -->
    <div v-if="postData" class="border-t border-zinc-800 p-4">
      <UButton :icon="showRawData ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" color="neutral"
        variant="ghost" size="sm" class="w-full justify-between text-zinc-400 hover:text-white" @click="toggleRawData">
        <span>{{ t('postDetail.viewRawData') }}</span>
      </UButton>

      <div v-if="showRawData" class="mt-4">
        <div class="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
          <pre class="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all">{{ JSON.stringify(postData, null, 2) }}
      </pre>
        </div>
      </div>
    </div>
    </div>

    <!-- Tab: Comments -->
    <div v-if="activeTab === 'comments'" class="p-4">
      <PostCommentsView v-if="postData" :post="postData" />
    </div>

    <!-- Tab: Stats -->
    <div v-if="activeTab === 'stats'" class="p-4">
      <PostStatsView v-if="postData" :post="postData" />
    </div>

  </div>
</template>

<style scoped></style>
