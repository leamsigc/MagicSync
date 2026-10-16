<!-- Translation file -->
<i18n src="./feeds.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Single post detail route.
 * Delegates the whole surface to the shared PostDetailPane so the route and
 * the Feed view's inline detail pane stay identical.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 */

import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import PostDetailPane from '#layers/BaseScheduler/app/components/scheduler/posts/components/PostDetailPane.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const post = ref<PostWithAllData | null>(null);
const isLoading = ref(true);
const loadError = ref('');

const loadPost = async () => {
  isLoading.value = true;
  loadError.value = '';

  try {
    const response = await $fetch<{ success: boolean, data: PostWithAllData }>(`/api/v1/posts/${route.params.id}`);
    post.value = response?.data ?? null;
  } catch (err) {
    loadError.value = t('postDetail.loadError');
    log.error({ message: 'Failed to load post detail', error: String(err) });
  } finally {
    isLoading.value = false;
  }
};

await loadPost();
watch(() => route.params.id, loadPost);

const goBack = () => {
  router.push('/app/posts');
};

setPageLayout('auth-twitter-layout');

useHead({
  title: post.value?.content ? `${post.value.content.slice(0, 50)}...` : t('postDetail.title')
});
</script>

<template>
  <div class="min-h-screen bg-default">
    <PostDetailPane :post="post" :loading="isLoading" :error="loadError" show-back @back="goBack" @retry="loadPost" />
  </div>
</template>

<style scoped></style>
