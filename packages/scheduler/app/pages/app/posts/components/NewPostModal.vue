<!--  Translation file -->
<i18n src="../posts.json"></i18n>

<script lang="ts" setup>
import { ref } from 'vue';
import { usePostManager } from '../composables/UsePostManager';
import PostModalContent from './PostModalContent.vue';
import type { PostCreateBase } from '#layers/BaseDB/db/schema';

const { t } = useI18n();
const { createPost } = usePostManager();

const isOpen = ref(false);
const postModalContentRef = ref<InstanceType<typeof PostModalContent> | null>(null);

const handleSave = async (postData: PostCreateBase) => {
  await createPost(postData);
  isOpen.value = false;
};

const handleClose = () => {
  isOpen.value = false;
};

const openModal = () => {
  isOpen.value = true;
};

</script>

<template>

  <UModal v-model:open="isOpen" @after:enter="postModalContentRef?.ResetToBase()" :dismissible="false"
    :ui="{ content: 'min-w-6xl overflow-y-auto', }">
    <UButton color="neutral" variant="solid" @click="openModal">
      <Icon name="lucide:edit" class="mr-2 h-4 w-4" />
      {{ t('buttons.schedule_post') }}
    </UButton>
    <template #content>
      <PostModalContent ref="postModalContentRef" @save="handleSave" @close="handleClose" />
    </template>
  </UModal>
</template>

<style scoped></style>
