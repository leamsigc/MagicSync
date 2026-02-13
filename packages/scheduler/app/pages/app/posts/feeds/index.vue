<!--  Translation file -->
<i18n src="../posts.json"></i18n>


<script lang="ts" setup>
/**
 *
 * Component Description: Post feeds page with infinite scroll
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */


import { usePostManager } from '../composables/UsePostManager';
import dayjs from 'dayjs'
import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types';


const activeBusinessId = useState<string>('business:id');
const { t } = usePostManager();

const router = useRouter()
const currentPage = ref(1)
const totalPages = ref(1)
const posts = ref<PostWithAllData[]>([])
const isLoading = ref(false)
const sentinelRef = ref<HTMLDivElement | null>(null)
const hasMore = computed(() => currentPage.value < totalPages.value)

const fetchPosts = async (page: number, append = false) => {
  if (isLoading.value) return

  isLoading.value = true

  try {
    const query = new URLSearchParams({
      businessId: activeBusinessId.value,
      page: page.toString(),
      limit: '10'
    })

    const { data: response } = await useFetch<PaginatedResponse<PostWithAllData>>(`/api/v1/posts?${query}`)

    if (response.value?.data) {
      if (append) {
        posts.value.push(...response.value.data)
      } else {
        posts.value = response.value.data
      }

      if (response.value.pagination) {
        totalPages.value = response.value.pagination.totalPages
        currentPage.value = response.value.pagination.page
      }
    }
  } catch (err) {
    console.error('Failed to fetch posts:', err)
  } finally {
    isLoading.value = false

  }
}

const loadMore = async () => {
  if (!hasMore.value || isLoading.value) return
  await fetchPosts(currentPage.value + 1, true)
}

const handleViewPost = (id: string) => {
  router.push(`/app/posts/feeds/${id}`)
}

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});

setPageLayout('auth-twitter-layout')

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {

      if (entry.isIntersecting && hasMore.value && !isLoading.value) {
        loadMore()
      }
    })
  },
  { rootMargin: '100px' }
)

onMounted(async () => {
  await fetchPosts(1)

  if (sentinelRef.value) {
    observer.observe(sentinelRef.value)

    onUnmounted(() => {
      observer.disconnect()
    })
  }
})
</script>

<template>
  <div>
    <TwitterMockEditor />
    <div class="my-10">
      <TwitterPostCard v-for="(post, index) in posts" :key="post.id" :id="post.id" :avatar="post.user.image || ''"
        :name="post.user.name" :username="post.user.firstName" :content="post.content" :scheduledAt="post.scheduledAt"
        :createdAt="post.createdAt" :likes="100" :retweets="100" :replies="post.platformContent?.comment?.length || 0"
        :views="100" :handle="post.user.firstName || ''" :timestamp="dayjs(post.scheduledAt).format('DD MMM YYYY')"
        :comments="post.platformContent?.comment || []" @view="handleViewPost" @open="handleViewPost">
        <template #media v-if="post.assets?.length">
          <div class="grid grid-cols-1 gap-5">
            <img :src="asset.url" alt="" v-for="(asset, index) in post.assets" :key="index"
              class="w-full h-full object-contain" />
          </div>
        </template>
      </TwitterPostCard>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center py-8">
        <Icon name="line-md:uploading-loop" size="lg" />
      </div>

      <!-- Sentinel for infinite scroll -->
      <div v-if="hasMore" ref="sentinelRef" class="h-10" />

      <!-- End of feed message -->
      <div v-if="!hasMore && posts.length > 0" class="text-center py-8 text-zinc-500">
        <p>{{ t('feeds.noMorePosts') }}</p>
      </div>

      <!-- Empty state -->
      <div v-if="!isLoading && posts.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-document-text" class="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <p class="text-zinc-500 text-lg">{{ t('feeds.noPostsFound') }}</p>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
