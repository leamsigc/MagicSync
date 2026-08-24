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
import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types';
import TwitterPostEditor from '../components/TwitterPostEditor.vue';
import PostFeedCard from '../components/PostFeedCard.vue';


const activeBusinessId = useState<string>('business:id');
const { t } = usePostManager();
setPageLayout('auth-twitter-layout')

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

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});


onMounted(async () => {
  await fetchPosts(1)

  if (sentinelRef.value) {
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
    observer.observe(sentinelRef.value as Element)

    onUnmounted(() => {
      observer.disconnect()
    })
  }
})

const HandleRefresh = async () => {
  console.log("Should refresh....");

  posts.value = []
  await fetchPosts(1)
}
</script>

<template>
  <div>
    <TwitterPostEditor @refresh="HandleRefresh" />
    <div class="my-10 max-w-2xl mx-auto">
      <div
v-if="posts.length"
        class="bg-elevated rounded-2xl border border-border overflow-hidden divide-y divide-border">
        <PostFeedCard v-for="post in posts" :key="post.id" :post="post" />
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center py-8">
        <Icon name="line-md:uploading-loop" size="lg" />
      </div>

      <!-- Sentinel for infinite scroll -->
      <div v-if="hasMore" ref="sentinelRef" class="h-10" />

      <!-- End of feed message -->
      <div v-if="!hasMore && posts.length > 0" class="text-center py-8 text-muted">
        <p>{{ t('feeds.noMorePosts') }}</p>
      </div>

      <!-- Empty state -->
      <div v-if="!isLoading && posts.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-newspaper" class="w-16 h-16 text-dimmed mx-auto mb-4" />
        <p class="text-muted text-lg">{{ t('feeds.noPostsFound') }}</p>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
