<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { displayAngle } from '../../../../utils/content-brief'
import type { ContentItemView } from '../../../../composables/useContentEditor'

/**
 * The card menu's Edit dialog (PRD-CONTENT-PIPELINE-OVERHAUL §10 D02, capability
 * D04): the idea's own title and brief, which is what the write chain is grounded
 * in. The body of the article is a different surface — that is the idea view.
 *
 * The brief field is seeded through the same sanitiser the card renders with, so
 * an envelope stored by an older run is shown as the prose it wraps and is only
 * sent back when the owner actually changes it.
 */

interface ContentDraft {
  title: string
  brief: string
}

const props = defineProps<{
  item: ContentItemView | null
  busy: boolean
}>()

const emit = defineEmits<{ save: [draft: ContentDraft] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const title = ref('')
const brief = ref('')
const seed = ref<ContentDraft>({ title: '', brief: '' })

const dirty = computed(() => title.value.trim() !== seed.value.title || brief.value.trim() !== seed.value.brief)
const canSave = computed(() => title.value.trim().length > 0 && dirty.value && !props.busy)

function loadItem(item: ContentItemView | null) {
  const draft: ContentDraft = {
    title: item?.title ?? '',
    brief: item ? displayAngle(item.brief) : '',
  }
  seed.value = draft
  title.value = draft.title
  brief.value = draft.brief
}

function handleCancel() {
  if (props.busy) return
  open.value = false
}

function handleSave() {
  if (!canSave.value) return
  emit('save', { title: title.value.trim(), brief: brief.value.trim() })
}

watch(open, (value) => {
  if (value) loadItem(props.item)
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('card.editTitleLabel')"
    :description="t('card.editHint')"
    :dismissible="!busy"
    :close="!busy"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-4" data-testid="card-edit-modal">
        <UFormField :label="t('card.titleField')" name="card-edit-title">
          <UInput
            v-model="title"
            class="w-full"
            :disabled="busy"
            data-testid="card-edit-title"
          />
        </UFormField>
        <UFormField :label="t('card.briefField')" :hint="t('card.briefHint')" name="card-edit-brief">
          <UTextarea
            v-model="brief"
            :rows="3"
            class="w-full"
            :disabled="busy"
            :placeholder="t('card.briefPlaceholder')"
            data-testid="card-edit-brief"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('card.cancel')"
          :disabled="busy"
          data-testid="card-edit-cancel"
          @click="handleCancel"
        />
        <UButton
          color="primary"
          icon="i-heroicons-check"
          :label="t('card.save')"
          :loading="busy"
          :disabled="!canSave"
          data-testid="card-edit-save"
          @click="handleSave"
        />
      </div>
    </template>
  </UModal>
</template>