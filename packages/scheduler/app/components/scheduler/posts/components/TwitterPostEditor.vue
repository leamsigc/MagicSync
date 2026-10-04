<i18n src="#site/app/pages/app/posts/new.json"></i18n>

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
import PostModalContent from './PostModalContent.vue';
import type { PostCreateBase } from '#layers/BaseDB/db/schema';
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager';

const { t } = useI18n();
const toast = useToast();
const { createPost } = usePostManager();
const postModalRef = ref<InstanceType<typeof PostModalContent> | null>(null);

const $emit = defineEmits(['refresh']);

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
    postModalRef.value?.ResetToBase();
    $emit('refresh');
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
  $emit('refresh');
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
  <PostModalContent
    ref="postModalRef" :preview="false" :initial-post="initialPost" @save="handleSave">
    <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
      <slot name="mic-recorder" v-bind="slotProps" />
    </template>
    <template v-if="$slots['template-variable']" #template-variable="slotProps">
      <slot name="template-variable" v-bind="slotProps" />
    </template>
    <template v-if="$slots['ai-assistant']" #ai-assistant="slotProps">
      <slot name="ai-assistant" v-bind="slotProps" />
    </template>
  </PostModalContent>
</template>
<style scoped></style>
