<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 * Audio Transcription Tool Main View
 * Convert speech to text with timestamps using AI models
 * Features matching xenova/whisper-web functionality.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */


import FileList from './Components/FileList.vue'
import TranscriptionUploader from './Components/TranscriptionUploader.vue'
import FileDetails from './Components/FileDetails.vue'
import ActiveTranscriptionToast from './Components/ActiveTranscriptionToast.vue'

const { t } = useI18n()

const {
  currentModel,
  currentLanguage,
  subtask,
  isMultilingual,
  isQuantized,
  files,
  isProcessing,
  isModelLoaded,
  modelProgress,
  AVAILABLE_MODELS,
  LANGUAGES,
  loadModel,
  addFiles,
  transcribeFile,
  abortTranscription,
  downloadTranscription
} = useTranscription()

const isModelLoading = computed(() => !isModelLoaded.value && modelProgress.value > 0 && modelProgress.value < 100)
const isModelReady = computed(() => isModelLoaded.value)

onMounted(() => {
  // load after 10 second the page is loaded
  loadModel('timestamped' as ModelKey)
})

const inputSource = ref<'file' | 'url' | 'record'>('file')
const selectedFileId = ref<string | null>(null)
const viewMode = ref<'list' | 'grid'>('list')
const isToastMinimized = ref(false)

const selectedFile = computed(() => {
  if (selectedFileId.value) {
    return files.value.find(f => f.id === selectedFileId.value) || null
  }
  return null
})

const activeFile = computed(() => files.value.find(f => f.status === 'transcribing') || null)

const displayFile = computed(() => activeFile.value || selectedFile.value)

const audioSrc = computed(() => {
  if (!selectedFile.value?.file) return ''
  return globalThis.URL.createObjectURL(selectedFile.value.file)
})

const activeAudioSrc = computed(() => {
  if (!displayFile.value?.file) return ''
  return globalThis.URL.createObjectURL(displayFile.value.file)
})

let currentObjectUrl = ''
watch(activeAudioSrc, (newUrl, oldUrl) => {
  if (oldUrl && oldUrl !== newUrl) {
    globalThis.URL.revokeObjectURL(oldUrl)
  }
  currentObjectUrl = newUrl
})

onUnmounted(() => {
  if (currentObjectUrl) {
    globalThis.URL.revokeObjectURL(currentObjectUrl)
  }
})

const modelOptions = computed(() =>
  Object.entries(AVAILABLE_MODELS)
    .filter(([, value]) => (!isMultilingual.value && !value.isDistil) || isMultilingual.value || value.isDistil)
    .map(([key, value]) => ({
      value: key,
      label: value.name,
      description: value.size
    }))
)

const languageOptions = computed(() =>
  LANGUAGES.map(lang => ({
    value: lang.code,
    label: lang.name
  }))
)

function handleModelChange(modelRaw: string) {
  loadModel(modelRaw as ModelKey)
}

function selectFile(file: TranscriptionFile) {
  selectedFileId.value = file.id
  isToastMinimized.value = false
  // Pre-load the model needed for re-running if necessary
}

function handleToastClear() {
  if (displayFile.value?.status === 'transcribing') {
    abortTranscription(displayFile.value.id)
  }
  selectedFileId.value = null
  isToastMinimized.value = false
}

function handleTranscriptionDownload(id: string, format: 'text' | 'json' | 'timestamps') {
  downloadTranscription(id, format)
}

useHead({
  title: t('title'),
  meta: [{ name: 'description', content: t('description') }]
})

defineOgImage({
  component: 'BlogOgImage',
  props: {
    title: t('title'),
    description: t('description'),
    headline: 'Free Tools',
    imageUrl: '/img/home-dark.png'
  }
})
</script>

<template>
  <div class="min-h-screen  text-gray-900 dark:text-gray-100 relative">
    <BaseHeader />

    <!-- Model Loading Overlay -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isModelLoading" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-800 max-w-md w-full mx-4">
          <div class="flex flex-col items-center text-center">
            <div class="relative mb-6">
              <UIcon name="i-lucide-brain" class="w-16 h-16 text-primary-500 animate-pulse" />
              <span class="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-4 w-4 bg-primary-500"></span>
              </span>
            </div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Loading AI Model</h3>
            <p class="text-gray-500 dark:text-gray-400 mb-6">Initializing Whisper transcription engine...</p>
            <div class="w-full space-y-2">
              <UProgress :model-value="modelProgress" color="primary" size="lg" class="w-full" />
              <p class="text-xs text-gray-400 font-medium">{{ modelProgress }}% complete</p>
            </div>
            <p class="text-xs text-gray-400 mt-4">This may take a few moments on first load</p>
          </div>
        </div>
      </div>
    </Transition>

    <div class="max-w-6xl mx-auto px-6 py-12">
      <div class="flex justify-between items-end mb-8 relative">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight">Recent Projects</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">Manage your locally stored transcriptions</p>
        </div>

        <div class="flex items-center gap-4">
          <!-- View Toggles -->
          <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <UButton :color="viewMode === 'grid' ? 'primary' : 'neutral'" :variant="viewMode === 'grid' ? 'soft' : 'ghost'"
              icon="i-lucide-layout-grid" size="sm" @click="viewMode = 'grid'" />
            <UButton :color="viewMode === 'list' ? 'primary' : 'neutral'" :variant="viewMode === 'list' ? 'soft' : 'ghost'"
              icon="i-lucide-list" size="sm" @click="viewMode = 'list'" />
          </div>

          <!-- Whisper-web specific settings block on top right -->
          <div v-motion-fade
            class="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div class="flex flex-col gap-1 items-start min-w-[200px]">
              <span class="text-[10px] uppercase tracking-widest font-bold text-gray-400">Model Engine</span>
              <USelect v-model="currentModel" :items="modelOptions" value-key="value" label-key="label"
                :disabled="isProcessing" size="sm" class="w-full" @update:model-value="handleModelChange" />
            </div>

            <div class="flex flex-col gap-2 border-l border-gray-200 dark:border-gray-800 pl-4">
              <div class="flex items-center gap-2">
                <USwitch v-model="isMultilingual" :disabled="isProcessing" color="primary" />
                <span class="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-tight">Multilingual</span>
              </div>
              <div class="flex items-center gap-2">
                <USwitch v-model="isQuantized" :disabled="isProcessing" color="primary" />
                <span class="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-tight">Quantized</span>
              </div>
            </div>

            <div v-if="isMultilingual"
              class="flex flex-col gap-1 border-l border-gray-200 dark:border-gray-800 pl-4 min-w-[150px]">
              <USelect v-model="currentLanguage" :items="languageOptions" value-key="value" label-key="label"
                :disabled="isProcessing" size="sm" class="w-full" />
              <USelect v-model="subtask"
                :items="[{ value: 'transcribe', label: 'Transcribe' }, { value: 'translate', label: 'Translate (to EN)' }]"
                value-key="value" label-key="label" :disabled="isProcessing" size="sm" class="w-full" />
            </div>
          </div>
        </div>
      </div>

      <FileList v-model:input-source="inputSource" :files="files" :view-mode="viewMode" :current-model="currentModel"
        @select="selectFile" @transcribe="transcribeFile" @abort="abortTranscription" />

      <TranscriptionUploader v-if="files.length == 0 || !selectedFile" v-model="inputSource" @files-added="addFiles" />
      <FileDetails v-if="selectedFile" :selected-file="selectedFile" :audio-src="audioSrc" :current-model="currentModel"
        :current-language="currentLanguage" :is-processing="isProcessing" @download="handleTranscriptionDownload"
        @transcribe="transcribeFile" />
    </div>

    <ActiveTranscriptionToast
      v-if="displayFile" :active-file="displayFile" :current-model="currentModel"
      :audio-src="activeAudioSrc" :is-minimized="isToastMinimized" @minimize="isToastMinimized = true"
      @maximize="isToastMinimized = false" @clear="handleToastClear" @abort="abortTranscription"
      @download="handleTranscriptionDownload" />
  </div>
</template>
