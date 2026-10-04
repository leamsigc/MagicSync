<!--  Translation file -->
<i18n src="#site/app/pages/tools/audio-transcription/index.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: DropZone component for uploading audio files
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

interface Props {
  isProcessing: boolean
  availableModels: { id: string; name: string; isMultilingual: boolean }[]
  isModelLoading: boolean
  modelLoadingProgress: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'drop', file: File, model: string, lang: string): void
  (e: 'modelChange', modelId: string): void
}>()

const { t } = useI18n()
const files = ref<File[]>([])
const selectedModel = ref<string>('')
const selectedLanguage = ref<string>('english')

const languages = [
  { id: 'english', name: 'English' },
  { id: 'spanish', name: 'Spanish' },
  { id: 'french', name: 'French' },
  { id: 'german', name: 'German' },
  { id: 'auto', name: 'Auto Detect' },
]

const selectedModelConfig = computed(() =>
  props.availableModels.find(m => m.id === selectedModel.value)
)

const isMultilingual = computed(() => {
  const config = selectedModelConfig.value
  return config ? config.isMultilingual !== false : true
})

watch(() => props.availableModels, (newModels) => {
  const firstModel = newModels[0]
  if (firstModel && !selectedModel.value) {
    selectedModel.value = firstModel.id
    emit('modelChange', firstModel.id)
  }
}, { immediate: true })

function onModelChange() {
  emit('modelChange', selectedModel.value)
}

function onFileChange(file: File | null | undefined) {
  if (!file) return
  if (props.isModelLoading) return

  const model = selectedModel.value || props.availableModels[0]?.id || 'onnx-community/whisper-tiny'

  emit('drop', file, model, selectedLanguage.value)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-2 mb-4">
      <div class="flex gap-4">
        <USelect v-model="selectedModel" :items="availableModels" value-key="id" label-key="name" variant="ghost"
          :placeholder="t('audio-transcription.model')" :disabled="isModelLoading || availableModels.length === 0"
          class="w-full max-w-xs" @change="onModelChange" />
        <USelect v-model="selectedLanguage" :items="languages" value-key="id" label-key="name" variant="ghost"
          :placeholder="t('audio-transcription.language')" :disabled="!isMultilingual || isModelLoading"
          class="w-full max-w-xs" />
      </div>
      <div v-if="isModelLoading" class="flex items-center gap-3 mt-2">
        <UProgress :model-value="modelLoadingProgress" color="success" size="xs" class="max-w-xs flex-1" />
        <span class="text-xs text-gray-400">
          {{ t('audio-transcription.loadingModel', { progress: Math.round(modelLoadingProgress || 0) }) }}
        </span>
      </div>
    </div>

    <UFileUpload v-model:value="files" accept="audio/*,video/*" :max-items="1" icon="i-lucide-upload-cloud"
      :label="t('audio-transcription.dropzone.label')" :description="t('audio-transcription.dropzone.description')"
      color="neutral" variant="area" :disabled="isModelLoading" class="min-h-80 bg-transparent"
      :ui="{ base: 'bg-transparent' }" @update:model-value="onFileChange" />
  </div>
</template>
