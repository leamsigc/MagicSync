<!--  Translation file -->
<i18n src="../posts.json"></i18n>

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
import { usePostManager } from '../composables/UsePostManager';
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
      <PostModalContent ref="postModalContentRef" @save="handleSave" @close="handleClose" />
    </template>
  </UModal>
</template>

<style scoped></style>
