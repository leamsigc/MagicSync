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
import type { PostCreateBase, PostWithAllData } from '#layers/BaseDB/db/schema';

const $emit = defineEmits(['refresh']);
const { updatePost } = usePostManager();

const isOpen = ref(false);
const postToUpdate = ref<PostWithAllData | undefined>(undefined);
const postModalContentRef = ref<InstanceType<typeof PostModalContent> | null>(null);

const handleUpdate = async (postData: PostCreateBase) => {
  if (postToUpdate.value?.id) {

    try {
      await updatePost(postToUpdate.value.id, postData);
      isOpen.value = false;
      $emit('refresh');
    } catch {
      // The service already toasted the failure; unstick the footer spinner
      // so the user can fix and retry with the modal still open.
      postModalContentRef.value?.clearSaving();
    }
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
  <UModal v-model:open="isOpen" :ui="{ content: 'md:min-w-6xl overflow-y-auto', }"
    @after:leave="postModalContentRef?.ResetToBase()" :dismissible="false">
    <template #content>
      <!-- PostModalContent pulls async preview chunks and editor weight on
        first mount: the skeleton holds the modal's two-pane shape meanwhile -->
      <Suspense>
        <PostModalContent
          ref="postModalContentRef" :initialPost="postToUpdate" @update="handleUpdate"
          @close="handleClose">
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

        <template #fallback>
          <div class="grid gap-6 p-6 md:grid-cols-[1fr_22rem]" aria-hidden="true">
            <div class="flex flex-col gap-4">
              <div class="flex gap-2">
                <USkeleton class="h-8 w-24 rounded-full" />
                <USkeleton class="h-8 w-24 rounded-full" />
                <USkeleton class="h-8 w-24 rounded-full" />
              </div>
              <USkeleton class="h-56 w-full rounded-xl" />
              <div class="flex gap-2">
                <USkeleton class="h-9 w-28 rounded-lg" />
                <USkeleton class="h-9 w-28 rounded-lg" />
              </div>
            </div>
            <USkeleton class="h-96 w-full rounded-xl" />
          </div>
        </template>
      </Suspense>
    </template>
  </UModal>
</template>

<style scoped></style>
