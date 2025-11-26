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
import type { PostCreateBase, PostWithAllData } from '#layers/BaseDB/db/schema';

const $emit = defineEmits(['refresh']);
const { updatePost } = usePostManager();

const isOpen = ref(false);
const postToUpdate = ref<PostWithAllData | undefined>(undefined);
const postModalContentRef = ref<InstanceType<typeof PostModalContent> | null>(null);

const handleUpdate = async (postData: PostCreateBase) => {
  if (postToUpdate.value?.id) {
    await updatePost(postToUpdate.value.id, postData);
    isOpen.value = false;
    $emit('refresh');
  }
};

const handleClose = () => {
  isOpen.value = false;
};

const openModal = (post: PostWithAllData) => {
  postToUpdate.value = post;
  isOpen.value = true;
};

defineExpose({
  openModal,
});
</script>

<template>
  <UModal v-model:open="isOpen" :ui="{ content: 'min-w-6xl overflow-y-auto', }"
    @after:leave="postModalContentRef?.ResetToBase()" :dismissible="false">
    <template #content>
      <PostModalContent ref="postModalContentRef" :initialPost="postToUpdate" @update="handleUpdate"
        @close="handleClose" />
    </template>
  </UModal>
</template>

<style scoped></style>
