<i18n src="./index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Audio Transcription Tool Main View
 * Convert speech to text with timestamps using AI models
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import DropZone from '#layers/BaseTools/app/components/tools/audio-transcription/DropZone.vue'
import RecentProjects from '#layers/BaseTools/app/components/tools/audio-transcription/RecentProjects.vue'
import ProjectDetail from '#layers/BaseTools/app/components/tools/audio-transcription/ProjectDetail.vue'
import Notch from '#layers/BaseTools/app/components/tools/audio-transcription/Notch.vue'

const { t } = useI18n()

const {
  projects,
  activeProject,
  isProcessing,
  processingProgress,
  processingStatus,
  availableModels,
  isModelLoading,
  modelLoadingProgress,
  loadProjects,
  initWorker,
  addProject,
  selectProject,
  removeProject,
  updateProject,
  setActiveProject,
  preloadModel,
  stopTranscription,
  currentTranscriptionId
} = useProject()

const isNotchExpanded = ref(false)

onMounted(() => {
  loadProjects()
  initWorker()
})

const handleDrop = (file: File, model: string, language: string) => {
  addProject(file, model, language)
}

const handleModelChange = (modelId: string) => {
  preloadModel(modelId)
}

const handleStop = () => {
  stopTranscription()
}

const handleSelect = (id: string) => {
  // selectProject(id)
  navigateTo(`/tools/audio-transcription/${id}`)
}

const handleDelete = (id: string) => {
  removeProject(id)
}

const handleStopFromTable = (id: string) => {
  if (currentTranscriptionId.value === id) {
    stopTranscription()
  }
}

const handleBack = () => {
  setActiveProject(null)
}

const handleUpdate = (id: string, updates: Record<string, unknown>) => {
  updateProject(id, updates)
}

useHead({
  title: t('audio-transcription.title'),
  meta: [{ name: 'description', content: t('audio-transcription.description') }]
})

defineOgImage('BlogOgImage', {
  title: t('audio-transcription.title'),
  description: t('audio-transcription.description'),
  headline: 'Free Tools',
  imageUrl: '/img/audio-transcription.png',
})
</script>

<template>
  <div class="min-h-screen font-sans ">
    <BaseHeader />
    <div class="max-w-6xl mx-auto p-6">
      <Notch v-if="isProcessing" :status="processingStatus" :progress="processingProgress"
        :is-expanded="isNotchExpanded" :active-project="activeProject" @toggle="isNotchExpanded = !isNotchExpanded"
        @stop="handleStop" />

      <header class="mb-12 mt-8">
        <h1 class="text-3xl font-semibold tracking-tight  mb-2">{{ t('audio-transcription.title') }}</h1>
        <p class="text-gray-400">{{ t('audio-transcription.description') }}</p>
      </header>

      <div v-if="!activeProject" class="space-y-12">
        <DropZone :is-processing="isProcessing" :available-models="availableModels" :is-model-loading="isModelLoading"
          :model-loading-progress="modelLoadingProgress" @drop="handleDrop" @model-change="handleModelChange" />
        <RecentProjects v-if="projects.length > 0" :projects="projects" @select="handleSelect" @delete="handleDelete"
          @stop="handleStopFromTable" />
      </div>

      <ProjectDetail v-else :project="activeProject" @back="handleBack" @update="handleUpdate" />
    </div>
  </div>
</template>
