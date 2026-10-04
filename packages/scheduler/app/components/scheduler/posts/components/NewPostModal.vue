<!--  Translation file -->
<i18n src="#site/app/pages/app/posts/posts.json"></i18n>

<script lang="ts" setup>
import { ref } from 'vue';
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager';
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
    :ui="{ content: 'md:min-w-6xl overflow-y-auto', wrapper: 'w-full min-w-full' }">
    <UButton color="neutral" variant="solid" @click="openModal">
      <Icon name="lucide:edit" class="md:mr-2 h-4 w-4" />
      <div class="hidden md:inline">
        {{ t('buttons.schedule_post') }}
      </div>
    </UButton>
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
