<!--  Translation file -->
<i18n src="./CsvUploader.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: CSV file uploader with drag and drop support
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [✔] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const emit = defineEmits<{
  fileSelected: [file: File]
}>()

const { t } = useI18n()
const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    processFile(target.files[0])
  }
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (files && files[0]) {
    processFile(files[0])
  }
}

const processFile = (file: File) => {
  if (!file.name.endsWith('.csv')) {
    alert(t('errors.csvOnly'))
    return
  }

  selectedFile.value = file
  emit('fileSelected', file)
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const removeFile = () => {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="w-full">
    <div class="border-2 border-dashed rounded-lg p-8 text-center transition-colors" :class="{
      'border-primary bg-primary/5': isDragging,
      'border-gray-300 hover:border-gray-400': !isDragging
    }" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop"
      @click="triggerFileInput">
      <input ref="fileInput" type="file" accept=".csv" class="hidden" @change="handleFileSelect">

      <div v-if="!selectedFile" class="flex flex-col items-center gap-4">
        <Icon name="i-heroicons-arrow-up-tray" class="w-12 h-12 text-gray-400" />
        <div>
          <p class="text-lg font-medium">{{ t('csvUploader.title') }}</p>
          <p class="text-sm text-gray-500">{{ t('csvUploader.subtitle') }}</p>
        </div>
        <UButton color="primary" variant="soft">
          {{ t('csvUploader.browse') }}
        </UButton>
      </div>

      <div v-else class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Icon name="i-heroicons-document-text" class="w-8 h-8 text-primary" />
          <div class="text-left">
            <p class="font-medium">{{ selectedFile.name }}</p>
            <p class="text-sm text-gray-500">
              {{ (selectedFile.size / 1024).toFixed(2) }} KB
            </p>
          </div>
        </div>
        <UButton icon="i-heroicons-x-mark" color="red" variant="ghost" @click.stop="removeFile" />
      </div>
    </div>
  </div>
</template>
