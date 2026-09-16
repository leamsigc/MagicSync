<i18n src="../content.json"></i18n>
<script setup lang="ts">
import { COMMON_PLATFORMS } from './board-types'

defineProps<{
  saving?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: { kind: string, days: number, platforms: string[], topic: string }]
}>()

const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const kind = ref('days')
const days = ref(7)
const platforms = ref<string[]>([])
const topic = ref('')

const kindItems = computed(() => [
  { label: t('states.idea'), value: 'days' },
  { label: t('columns.drafting'), value: 'carousel' },
  { label: t('columns.delivery'), value: 'reel' },
  { label: t('actions.generate'), value: 'repurpose' },
])

watch(open, (isOpen) => {
  if (isOpen) {
    kind.value = 'days'
    days.value = 7
    platforms.value = []
    topic.value = ''
  }
})

function handleOpenChange(value: boolean) {
  open.value = value
}

function handleSubmit() {
  if (!topic.value.trim()) return
  emit('submit', {
    kind: kind.value,
    days: Math.min(Math.max(Number(days.value) || 1, 1), 31),
    platforms: platforms.value,
    topic: topic.value.trim(),
  })
}
</script>

<template>
  <UModal :open="open" :title="t('batch.title')" @update:open="handleOpenChange">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('batch.kind')">
          <USelect v-model="kind" :items="kindItems" class="w-full" />
        </UFormField>
        <UFormField :label="t('batch.days')">
          <UInput v-model.number="days" type="number" min="1" max="31" class="w-full" />
        </UFormField>
        <UFormField :label="t('batch.topic')">
          <UInput v-model="topic" :placeholder="t('batch.topicPlaceholder')" class="w-full" />
        </UFormField>
        <UFormField :label="t('create.platforms')">
          <USelectMenu v-model="platforms" :items="COMMON_PLATFORMS" multiple class="w-full" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="handleOpenChange(false)">
          {{ t('actions.cancel') }}
        </UButton>
        <UButton color="primary" :loading="saving" :disabled="!topic.trim()" @click="handleSubmit">
          {{ t('batch.submit') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
