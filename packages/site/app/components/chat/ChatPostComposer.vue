<i18n src="./chat-post-composer.json"></i18n>
<script lang="ts" setup>
/**
 * The full post composer, embedded in chat. It reuses the exact editor that
 * `/app/posts/new` renders (real platform previews, media library, schedule
 * picker) so a chat draft can be finished with first-class parity. This lives in
 * the site package because only the composition root may import the scheduler
 * editor from a chat surface.
 */
import PostModalContent from '#layers/BaseScheduler/app/components/scheduler/posts/components/PostModalContent.vue'
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import PostAIAssistant from '#layers/BaseTemplate/app/components/PostAIAssistant.vue'
import TemplateVariablePopUp from '#layers/BaseTemplate/app/components/TemplateVariablePopUp.vue'
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager'
import type { PostCreateBase } from '#layers/BaseDB/db/schema'

interface ComposerDraft {
  content: string
  mediaAssets?: string[]
  accounts?: Array<{ id: string, platform: string }>
}

const props = defineProps<{
  open: boolean
  businessId: string
  draft: ComposerDraft | null
  variant?: 'modal' | 'inline'
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()
const { createPost } = usePostManager()
const postModalRef = ref<InstanceType<typeof PostModalContent> | null>(null)

const initialPost = computed(() => {
  const draft = props.draft
  if (!draft) return undefined
  return {
    content: draft.content,
    comment: [],
    mediaAssets: JSON.stringify(draft.mediaAssets ?? []),
    scheduledAt: new Date(),
    platformPosts: (draft.accounts ?? []).map(account => ({
      platformPostId: account.platform,
      socialAccountId: account.id,
    })),
  } as never
})

async function handleSave(postData: PostCreateBase) {
  try {
    await createPost({ ...postData, businessId: props.businessId })
    toast.add({ title: t('saved'), icon: 'i-heroicons-check-circle', color: 'success' })
    emit('saved')
    emit('update:open', false)
  } catch (error: unknown) {
    postModalRef.value?.clearSaving()
    toast.add({
      title: t('saveFailed'),
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

function handleOpenChange(value: boolean) {
  emit('update:open', value)
}
</script>

<template>
  <UModal v-if="variant !== 'inline'" :open="open" :title="t('title')" :ui="{ content: 'max-w-6xl' }" @update:open="handleOpenChange">
    <template #body>
      <PostModalContent
        ref="postModalRef"
        :initial-post="initialPost"
        @save="handleSave"
        @close="handleOpenChange(false)"
      >
        <template #mic-recorder="{ onTranscript }">
          <MicRecorder @transcript="onTranscript" />
        </template>
        <template #template-variable="{ onAction }">
          <TemplateVariablePopUp @action="onAction" />
        </template>
        <template #ai-assistant="{ loading, onAction, onTemplateAction }">
          <PostAIAssistant :loading="loading" @action="onAction" @template-action="onTemplateAction" />
        </template>
      </PostModalContent>
    </template>
  </UModal>

  <div v-else class="rounded-xl border border-gray-200 dark:border-gray-800 bg-default overflow-hidden" data-testid="chat-post-composer">
    <div class="flex items-center justify-between px-4 pt-4">
      <h3 class="text-sm font-semibold">{{ t('title') }}</h3>
      <UButton color="neutral" variant="ghost" icon="i-heroicons-x-mark-20-solid"
        @click="handleOpenChange(false)" />
    </div>
    <PostModalContent
      ref="postModalRef"
      :initial-post="initialPost"
      platforms-position="left"
      @save="handleSave"
      @close="handleOpenChange(false)"
    >
      <template #mic-recorder="{ onTranscript }">
        <MicRecorder @transcript="onTranscript" />
      </template>
      <template #template-variable="{ onAction }">
        <TemplateVariablePopUp @action="onAction" />
      </template>
      <template #ai-assistant="{ loading, onAction, onTemplateAction }">
        <PostAIAssistant :loading="loading" @action="onAction" @template-action="onTemplateAction" />
      </template>
    </PostModalContent>
  </div>
</template>
