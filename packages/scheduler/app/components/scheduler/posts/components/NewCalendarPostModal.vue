<!--  Translation file -->
<i18n src="#site/app/pages/app/posts/posts.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Modal for updating an existing social media post.
 * It uses the shared PostModalContent component to display and handle post data.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *>
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { ref } from 'vue';
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager';
import PostModalContent from './PostModalContent.vue';
import type { PostCreateBase, } from '#layers/BaseDB/db/schema';

const $emit = defineEmits(['refresh']);

const { createPost } = usePostManager();

const isOpen = ref(false);
const postModalContentRef = ref<InstanceType<typeof PostModalContent> | null>(null);

const handleSave = async (postData: PostCreateBase) => {
  await createPost(postData);
  isOpen.value = false;
  $emit('refresh');
};

const handleClose = () => {
  isOpen.value = false;
};

const openModal = (date: Date) => {
  isOpen.value = true;
  // delay 2 seconds
  const id = setTimeout(() => {
    postModalContentRef.value?.setScheduleDateAt(date);
    clearTimeout(id);
  }, 200);
};

defineExpose({
  openModal,
});
</script>

<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'md:min-w-6xl overflow-y-auto', }"
    @after:leave="postModalContentRef?.ResetToBase()" :dismissible="false">
    <template #content>
      <PostModalContent
        ref="postModalContentRef" @save="handleSave" @close="handleClose">
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
  </UModal>
</template>

<style scoped></style>
