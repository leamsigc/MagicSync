<i18n src="./new.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Standalone page for creating a new social media post
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import PostModalContent from './components/PostModalContent.vue';
import type { PostCreateBase } from '#layers/BaseDB/db/schema';
import { usePostManager } from './composables/UsePostManager';

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const { createPost, updatePost } = usePostManager();

useSeoMeta({
  title: () => t('page.title'),
  description: () => t('page.description'),
});

const postModalRef = ref<InstanceType<typeof PostModalContent> | null>(null);

type RepurposedContent = {
  content: string;
  fullContent: string;
  platform: string;
  isThread: boolean;
  comments: string[];
  mediaAssets?: string[];
  platformOverrides?: Record<string, string>;
};

const repurposedContent = ref<RepurposedContent | null>(null);

onMounted(() => {
  const stored = sessionStorage.getItem('repurposed-content');
  if (stored) {
    try {
      repurposedContent.value = JSON.parse(stored);
      sessionStorage.removeItem('repurposed-content');
    } catch {
      repurposedContent.value = null;
    }
  }
});

const handleSave = async (postData: PostCreateBase) => {
  try {
    await createPost(postData);
    toast.add({
      title: t('toast.postCreated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    });
    router.push('/app/posts');
  } catch (error: any) {
    toast.add({
      title: t('toast.postCreatedFailed'),
      description: error?.message || '',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    });
  }
};

const handleUpdate = async (postData: PostCreateBase) => {
  try {
    if (!postData.id) return;
    await updatePost(postData.id, postData);
    toast.add({
      title: t('toast.postUpdated'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    });
    router.push('/app/posts');
  } catch (error: any) {
    toast.add({
      title: t('toast.postCreatedFailed'),
      description: error?.message || '',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'error',
    });
  }
};

const handleClose = () => {
  router.push('/app/posts');
};

const initialPost = computed(() => {
  if (!repurposedContent.value) return undefined;

  return {
    content: repurposedContent.value.content,
    comment: repurposedContent.value.isThread ? repurposedContent.value.comments : [],
    mediaAssets: JSON.stringify(repurposedContent.value.mediaAssets || []),
    platformContent: repurposedContent.value.platformOverrides
      ? Object.fromEntries(
        Object.entries(repurposedContent.value.platformOverrides).map(([k, v]) => [k, { content: v }])
      )
      : undefined,
  } as any;
});
</script>

<template>
  <div class="min-h-screen p-4 md:p-8">
    <div class="max-w-7xl mx-auto">
      <div class="mb-6">
        <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="handleClose">
          {{ t('page.back') }}
        </UButton>
      </div>

      <header class="mb-8">
        <h1 class="text-3xl font-bold">{{ t('page.title') }}</h1>
        <p class="text-muted mt-2">{{ t('page.description') }}</p>
      </header>

      <PostModalContent ref="postModalRef" :initial-post="initialPost" @save="handleSave" @update="handleUpdate"
        @close="handleClose" />
    </div>
  </div>
</template>
<style scoped></style>
