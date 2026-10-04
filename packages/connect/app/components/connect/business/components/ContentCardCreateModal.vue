<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
/**
 * Create a card by hand, for an idea the owner already has.
 *
 * A scan asks the model what to write about; this asks the owner. Both land in
 * Planned, so the two doors lead to the same place and nothing downstream has to
 * know which one a card came through.
 */

interface ContentDraft {
  title: string
  brief: string
}

const props = defineProps<{ busy: boolean }>()

const emit = defineEmits<{ create: [draft: ContentDraft] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const title = ref('')
const brief = ref('')

const canSave = computed(() => title.value.trim().length > 0 && !props.busy)

function handleCancel() {
  if (props.busy) return
  open.value = false
}

function handleCreate() {
  if (!canSave.value) return
  emit('create', { title: title.value.trim(), brief: brief.value.trim() })
}

/** Reopening the dialog always starts from a blank card, never the last one. */
function reset() {
  title.value = ''
  brief.value = ''
}

watch(open, (value) => {
  if (value) reset()
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('card.createTitleLabel')"
    :description="t('card.createHint')"
    :dismissible="!busy"
    :close="!busy"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-4" data-testid="card-create-modal">
        <UFormField :label="t('card.titleField')" name="card-create-title">
          <UInput
            v-model="title"
            class="w-full"
            :disabled="busy"
            :placeholder="t('card.createTitlePlaceholder')"
            data-testid="card-create-title"
            @keydown.enter="handleCreate"
          />
        </UFormField>
        <UFormField :label="t('card.briefField')" :hint="t('card.briefHint')" name="card-create-brief">
          <UTextarea
            v-model="brief"
            :rows="3"
            class="w-full"
            :disabled="busy"
            :placeholder="t('card.createBriefPlaceholder')"
            data-testid="card-create-brief"
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
          data-testid="card-create-cancel"
          @click="handleCancel"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          :label="t('card.create')"
          :loading="busy"
          :disabled="!canSave"
          data-testid="card-create-save"
          @click="handleCreate"
        />
      </div>
    </template>
  </UModal>
</template>