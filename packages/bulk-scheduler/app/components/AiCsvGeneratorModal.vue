<i18n src="./AiCsvGeneratorModal.json"></i18n>

<script lang="ts" setup>
export interface CsvRowData {
  content: string
  image_url: string
  scheduled_time: string
  comments: string
}

const emit = defineEmits<{
  generated: [rows: CsvRowData[]]
  close: []
}>()

const { t } = useI18n()
const toast = useToast()
const prompt = ref('')
const isGenerating = ref(false)

const handleGenerate = async () => {
  if (!prompt.value.trim()) return

  isGenerating.value = true
  try {
    const response = await $fetch<{ result: Array<{ content: string; image_url?: string; scheduled_time?: string; comments?: string }> }>('/api/v1/ai/generate', {
      method: 'POST',
      body: {
        action: 'generateCsv',
        content: prompt.value
      }
    })

    const rows = response.result.map(item => ({
      content: item.content || '',
      image_url: item.image_url || '',
      scheduled_time: item.scheduled_time || '',
      comments: item.comments || ''
    }))

    if (rows.length === 0) {
      toast.add({
        title: t('aiCsvGenerator.noPostsGenerated'),
        icon: 'i-heroicons-exclamation-triangle',
        color: 'warning'
      })
      return
    }

    toast.add({
      title: t('aiCsvGenerator.generated', { count: rows.length }),
      icon: 'i-heroicons-check-circle',
      color: 'success'
    })

    emit('generated', rows)
  } catch (err: any) {
    toast.add({
      title: t('aiCsvGenerator.error'),
      description: err.message || t('aiCsvGenerator.errorDescription'),
      icon: 'i-heroicons-x-circle',
      color: 'error'
    })
  } finally {
    isGenerating.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">{{ t('aiCsvGenerator.title') }}</h3>
        <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" @click="$emit('close')" />
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-sm text-gray-600">{{ t('aiCsvGenerator.description') }}</p>

      <UFormField :label="t('aiCsvGenerator.promptLabel')" name="prompt" required>
        <UTextarea
          v-model="prompt"
          :placeholder="t('aiCsvGenerator.promptPlaceholder')"
          class="w-full"
          :rows="6"
          autoresize
        />
      </UFormField>

      <p class="text-xs text-gray-400">{{ t('aiCsvGenerator.hint') }}</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="ghost" @click="$emit('close')">
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isGenerating"
          :disabled="!prompt.trim()"
          @click="handleGenerate"
        >
          {{ t('aiCsvGenerator.generate') }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
