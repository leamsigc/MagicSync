<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import type { ContentItemView } from '../../../../composables/useContentEditor'

/**
 * The card menu's Delete step (PRD-CONTENT-PIPELINE-OVERHAUL §10 D02). Removing a
 * card is irreversible and destroys an article that may already have been written,
 * so it never happens on a single click: the menu opens this dialog first and only
 * the confirm control calls the delete.
 */

const props = defineProps<{
  item: ContentItemView | null
  busy: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

function handleCancel() {
  if (props.busy) return
  open.value = false
}

function handleConfirm() {
  if (props.busy) return
  emit('confirm')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('card.deleteTitle')"
    :dismissible="!busy"
    :close="!busy"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <p class="text-sm leading-relaxed text-muted" data-testid="card-delete-modal">
        {{ t('card.deleteBody', { title: item?.title ?? '' }) }}
      </p>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('card.cancel')"
          :disabled="busy"
          data-testid="card-delete-cancel"
          @click="handleCancel"
        />
        <UButton
          color="error"
          icon="i-heroicons-trash"
          :label="t('card.delete')"
          :loading="busy"
          data-testid="card-delete-confirm"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>