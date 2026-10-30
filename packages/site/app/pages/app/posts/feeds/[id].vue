<!-- Translation file -->
<i18n src="./feeds.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Single post detail route.
 * Delegates the whole surface to the shared PostDetailPane so the route and
 * the Feed view's inline detail pane stay identical. The route adopts the
 * shared collection shell (header + primary action) but declares no view
 * modes: one post is a record, not a collection, so the pane stays the body.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.3
 */

import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import PostDetailPane from '#layers/BaseScheduler/app/components/scheduler/posts/components/PostDetailPane.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const post = ref<PostWithAllData | null>(null);
const isLoading = ref(true);
const loadError = ref('');

const shortId = computed(() => post.value?.id?.slice(0, 8) ?? '');

const subtitle = computed(() => {
  if (!post.value) return t('postDetail.loading')
  const author = post.value.user?.name || ''
  return author ? `${author} · #${shortId.value}` : `#${shortId.value}`
});

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
  <BaseCollectionPage :title="t('postDetail.title')" :description="subtitle" back-to="" container="wide">
    <template #actions>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" :loading="isLoading"
        :label="t('postDetail.refresh')" @click="loadPost" />
    </template>

    <PostDetailPane :post="post" :loading="isLoading" :error="loadError" show-back @back="goBack" @retry="loadPost" />
  </BaseCollectionPage>
</template>

<style scoped></style>
