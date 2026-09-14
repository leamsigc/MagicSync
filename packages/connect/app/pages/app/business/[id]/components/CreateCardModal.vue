<i18n src="../content.json"></i18n>
<script setup lang="ts">
import { COMMON_PLATFORMS } from './board-types'

defineProps<{
  saving?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: { title: string, brief: string, platforms: string[] }]
}>()

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const title = ref('')
const brief = ref('')
const platforms = ref<string[]>([])
const error = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    title.value = ''
    brief.value = ''
    platforms.value = []
    error.value = ''
  }
})

function handleOpenChange(value: boolean) {
  open.value = value
}

function handleSubmit() {
  if (!title.value.trim()) {
    error.value = t('create.required')
    return
  }
  error.value = ''
  emit('submit', { title: title.value.trim(), brief: brief.value.trim(), platforms: platforms.value })
}
</script>

<template>
  <UModal :open="open" :title="t('create.title')" @update:open="handleOpenChange">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('create.name')" :error="error">
          <UInput v-model="title" :placeholder="t('create.namePlaceholder')" class="w-full" data-testid="board-create-title" />
        </UFormField>
        <UFormField :label="t('create.brief')">
          <UTextarea v-model="brief" :placeholder="t('create.briefPlaceholder')" class="w-full" :rows="3" />
        </UFormField>
        <UFormField :label="t('create.platforms')">
          <USelectMenu
            v-model="platforms"
            :items="COMMON_PLATFORMS"
            multiple
            :placeholder="t('create.platformsPlaceholder')"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="handleOpenChange(false)">
          {{ t('actions.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" data-testid="board-create-submit" @click="handleSubmit">
          {{ t('actions.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
