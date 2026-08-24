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
const cropperMediaAssetId = ref<string | null>(null);

function readStorage(): void {
  const storedCropper = sessionStorage.getItem('video-cropper-media');
  if (storedCropper) {
    try {
      const parsed = JSON.parse(storedCropper);
      if (parsed?.assetId) cropperMediaAssetId.value = parsed.assetId;
      sessionStorage.removeItem('video-cropper-media');
    } catch {
      sessionStorage.removeItem('video-cropper-media');
    }
  }
  const stored = sessionStorage.getItem('repurposed-content');
  if (stored) {
    try {
      repurposedContent.value = JSON.parse(stored);
      sessionStorage.removeItem('repurposed-content');
    } catch {
      repurposedContent.value = null;
    }
  }
}

// Read synchronously on client so initialPost is ready before child mounts
if (import.meta.client) {
  readStorage();
}

onMounted(() => {
  // Fallback for cases where sessionStorage was written after initial hydration
  if (!repurposedContent.value && !cropperMediaAssetId.value) {
    readStorage();
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

const handleUpdate = async (postData: PostCreateBase & { id: string }) => {
  try {
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
  if (!repurposedContent.value && !cropperMediaAssetId.value) return undefined;

  const mediaAssets: string[] = cropperMediaAssetId.value
    ? [cropperMediaAssetId.value]
    : repurposedContent.value?.mediaAssets || [];

  return {
    content: repurposedContent.value?.content ?? '',
    comment: repurposedContent.value?.isThread ? repurposedContent.value.comments : [],
    mediaAssets: JSON.stringify(mediaAssets),
    platformContent: repurposedContent.value?.platformOverrides
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
