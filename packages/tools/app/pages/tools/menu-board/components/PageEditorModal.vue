<i18n src="../index.json"></i18n>
<script setup lang="ts">
/**
 *
 * PageEditorModal — edit a menu board page (name, content, active state).
 *
 * - AI Assistant: logged-in users only (uses the system AI connection).
 * - Image pages: logged-in users can pick from their uploaded assets.
 *
 */
import type { MenuPage } from '../types'
import AssetsPickerModal from './AssetsPickerModal.vue'

const { t } = useI18n()

interface Props {
  open: boolean
  page: MenuPage | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [page: MenuPage]
}>()

const { loggedIn } = UseUser()
const { generateWithAi } = useMenuBoard()

const draft = ref<MenuPage | null>(null)
const aiPrompt = ref('')
const isGenerating = ref(false)
const showAssetsPicker = ref(false)

watch(
  () => props.page,
  (page) => {
    draft.value = page ? JSON.parse(JSON.stringify(page)) : null
    aiPrompt.value = ''
  },
  { immediate: true },
)

async function handleAiUpdate(): Promise<void> {
  if (!draft.value || !aiPrompt.value.trim() || draft.value.type !== 'html') return
  isGenerating.value = true
  try {
    const html = await generateWithAi(aiPrompt.value.trim(), draft.value.content)
    if (html) draft.value = { ...draft.value, content: html }
    aiPrompt.value = ''
  } catch {
    toastAddError()
  } finally {
    isGenerating.value = false
  }
}

function toastAddError(): void {
  useToast().add({
    title: t('ai_update_failed_title'),
    description: t('ai_update_failed_desc'),
    color: 'error',
    icon: 'i-lucide-sparkles',
  })
}

function handleAssetSelect(url: string): void {
  if (draft.value) {
    draft.value = { ...draft.value, content: url }
  }
}

function handleSave(): void {
  if (!draft.value) return
  emit('save', draft.value)
  emit('update:open', false)
}
</script>

<template>
  <div>
    <UModal :open="open" @update:open="emit('update:open', $event)">
      <template #content>
        <div v-if="draft" class="p-6 space-y-4" data-testid="page-editor">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold tracking-tight">{{ t('edit_page') }}</h2>
            <UButton variant="ghost" color="neutral" icon="i-lucide-x" data-testid="page-editor-close"
              @click="() => { emit('update:open', false) }" />
          </div>

          <UFormField :label="t('page_name')">
            <UInput v-model="draft.name" class="w-full" data-testid="page-editor-name" />
          </UFormField>

          <UFormField :label="draft.type === 'html' ? t('html_content') : t('image_label')">
            <UTextarea v-if="draft.type === 'html'" v-model="draft.content" class="w-full font-mono text-sm" :rows="10"
              placeholder="<div>...</div>" data-testid="page-editor-content" />
            <template v-else>
              <div v-if="draft.content" class="mb-3 rounded-xl overflow-hidden  max-h-48">
                <img :src="draft.content" alt="Selected image preview" class="w-full object-contain max-h-48"
                  @error="($event.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/600/400'" />
              </div>
              <div class="flex flex-col sm:flex-row gap-2">
                <UButton v-if="loggedIn" variant="outline" color="neutral" icon="i-lucide-folder-open"
                  data-testid="choose-from-assets" @click="() => { showAssetsPicker = true }">
                  {{ t('choose_from_assets') }}
                </UButton>
                <UInput v-model="draft.content" class="flex-1" placeholder="https://picsum.photos/seed/my-image/600/400"
                  data-testid="page-editor-image-url" />
              </div>
            </template>
          </UFormField>

          <USwitch v-model="draft.isActive" :label="t('active_rotation')" data-testid="page-editor-active" />

          <!-- AI assistant — logged-in users only (system AI connection) -->
          <div v-if="loggedIn && draft.type === 'html'" class=" pt-4 space-y-3">
            <h3 class="font-medium flex items-center gap-2 text-primary">
              <UIcon name="i-lucide-sparkles" class="size-4" /> {{ t('ai_assistant') }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ t('ai_desc') }}
            </p>
            <UTextarea v-model="aiPrompt" :rows="3" class="w-full"
              :placeholder="t('ai_placeholder')" data-testid="ai-prompt" />
            <UButton :loading="isGenerating" :disabled="!aiPrompt.trim()" icon="i-lucide-wand-2" variant="outline"
              data-testid="ai-generate" @click="handleAiUpdate">
              {{ isGenerating ? t('generating') : t('update_with_ai') }}
            </UButton>
          </div>
          <p v-else-if="!loggedIn && draft.type === 'html'"
            class="text-sm text-muted-foreground  pt-4 flex items-center gap-2" data-testid="ai-guest-hint">
            <UIcon name="i-lucide-lock" class="size-4 shrink-0" />
            {{ t('ai_guest_hint') }}
          </p>

          <div class="flex justify-end pt-4  gap-3">
            <UButton variant="ghost" color="neutral" @click="() => { emit('update:open', false) }">
              {{ t('cancel') }}
            </UButton>
            <UButton data-testid="page-editor-save" @click="handleSave">
              {{ t('save_page') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <AssetsPickerModal v-model:open="showAssetsPicker" @select="handleAssetSelect" />
  </div>
</template>
