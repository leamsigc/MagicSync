<!-- Translation file -->
<i18n src="./index.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Video Silence Remover Tool
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */


const { removeSilence, processingId } = useRemoveSilence()
const { t } = useI18n()
const toast = useToast()

const uploadedVideo = ref<File[]>([])
const videoUrl = ref<string>('')
const processedVideo = ref<any>(null)
const progress = ref<number>(0)
const silenceThreshold = ref<number>(15)
const bufferFrames = ref<number>(15)
const isProcessing = computed(() => !!processingId.value)

// Watch for file uploads
watch(uploadedVideo, (newFiles) => {
  if (newFiles && newFiles.length > 0) {
    const file = newFiles[0]
    if (file && file.type.startsWith('video/')) {
      videoUrl.value = URL.createObjectURL(file)
      processedVideo.value = null
    }
  } else {
    videoUrl.value = ''
    processedVideo.value = null
  }
})

const handleRemoveSilence = async () => {
  if (!uploadedVideo.value || uploadedVideo.value.length === 0 || !videoUrl.value) return

  const file = uploadedVideo.value[0]
  if (!file) return
  const video = {
    id: file.name,
    url: videoUrl.value,
    duration: 0, // Will be calculated
    hasSilenceRemoved: false
  }

  try {
    toast.add({
      title: t('processing'),
      description: t('video_processing_started'),
      color: 'info'
    })

    await removeSilence(
      video,
      (updatedVideo: any) => {
        processedVideo.value = updatedVideo
        toast.add({
          title: t('success'),
          description: t('video_processed_successfully'),
          color: 'success'
        })
      },
      (prog: number) => {
        progress.value = prog
      },
      silenceThreshold.value,
      bufferFrames.value
    )
  } catch (error: any) {
    toast.add({
      title: t('error'),
      description: error.message,
      color: 'error'
    })
  }
}

const deleteFile = () => {
  uploadedVideo.value = []
  videoUrl.value = ''
  processedVideo.value = null
  progress.value = 0
}

const downloadVideo = () => {
  if (!processedVideo.value) return

  const a = document.createElement('a')
  a.href = processedVideo.value.url
  a.download = `processed-${uploadedVideo.value[0]?.name || 'video'}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

useHead({
  title: t('title'),
  meta: [
    { name: 'description', content: t('description') },
    { name: 'keywords', content: 'free video silence remover, remove silence from video, video editor online, silence detection, audio processing' }
  ]
})


const onFileDrop = async (f: File | File[] | null | undefined) => {
  if (!f) return
  uploadedVideo.value = Array.isArray(f) ? f : [f]
}

const MAX_FILE_SIZE = 1000 * 1024 * 1024 // 1GB
</script>

<template>
  <div class="min-h-screen bg-linear-to-br from-neutral-900 via-neutral-800 to-neutral-900">
    <BaseHeader />
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">{{ t('video_silence_remover') }}</h1>
        <p class="text-neutral-300">{{ t('upload_video_to_remove_silence') }}</p>
      </div>

      <!-- No File Selected State -->
      <div v-if="!videoUrl" class="flex items-center justify-center min-h-[60vh]">
        <BaseShinyCard class="w-full max-w-lg p-8 cursor-pointer">
          <UCard class="">
            <section class="grid gap-4">
              <!-- File Upload -->
              <div>
                <UFileUpload @update:model-value="onFileDrop" accept="video/*" :max-size="MAX_FILE_SIZE" color="primary"
                  variant="area" :label="t('drag_and_drop_files_here')" :description="t('supported_formats')"
                  class="w-full min-h-48" />
              </div>

              <!-- Actions -->
              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <UButton variant="outline" class="flex-1">
                  <UIcon name="i-heroicons-video-camera" class="mr-2" />
                  {{ t('record_video') }}
                </UButton>
              </div>

            </section>
          </UCard>
        </BaseShinyCard>
      </div>

      <!-- File Selected State -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Left Side: Video Player -->
        <BaseShinyCard class="p-6">
          <UCard class="space-y-4">
            <div class="grid gap-4">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-white">{{ t('original_video') }}</h3>
                <UButton variant="ghost" color="error" @click="deleteFile">
                  <UIcon name="i-heroicons-trash" class="mr-2" />
                  {{ t('delete') }}
                </UButton>
              </div>

              <video :src="videoUrl" controls class="w-full rounded-lg border border-neutral-600"
                preload="metadata"></video>

              <!-- Threshold Settings -->
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-white mb-2">{{ t('silence_threshold') }}</label>
                  <input v-model.number="silenceThreshold" type="range" min="5" max="50" class="w-full" />
                  <span class="text-sm text-neutral-400">{{ silenceThreshold }}/255</span>
                </div>
                <div>
                  <label class="block text-sm font-medium text-white mb-2">{{ t('buffer_frames') }}</label>
                  <input v-model.number="bufferFrames" type="range" min="5" max="30" class="w-full" />
                  <span class="text-sm text-neutral-400">{{ bufferFrames }} frames</span>
                </div>
              </div>

              <UButton :disabled="isProcessing" @click="handleRemoveSilence" class="w-full" color="primary">
                <UIcon name="i-heroicons-scissors" class="mr-2" />
                {{ isProcessing ? t('processing') : t('remove_silence') }}
              </UButton>
            </div>
          </UCard>
        </BaseShinyCard>

        <!-- Right Side: Status and Results -->
        <BaseShinyCard class="p-6">
          <UCard class="space-y-6 h-full">
            <div class="grid gap-4">
              <h3 class="text-lg font-semibold text-white mb-4">{{ t('status') }}</h3>

              <!-- Processing Status -->
              <div v-if="isProcessing" class="space-y-4">
                <div class="flex justify-between text-sm text-white">
                  <span>{{ t('processing_video') }}</span>
                  <span>{{ Math.round(progress) }}%</span>
                </div>
                <UProgress :value="progress" class="w-full" />
              </div>

              <!-- Ready Status -->
              <div v-else-if="!processedVideo" class="text-center py-8">
                <UIcon name="i-heroicons-check-circle" class="mx-auto h-12 w-12 text-green-400 mb-4" />
                <p class="text-white">{{ t('ready_to_process') }}</p>
              </div>

              <!-- Processed Video -->
              <div v-if="processedVideo" class="space-y-4">
                <h4 class="text-md font-medium text-white">{{ t('processed_video') }}</h4>
                <video :src="processedVideo.url" controls class="w-full rounded-lg border border-neutral-600"
                  preload="metadata"></video>

                <div class="text-sm text-neutral-400 space-y-1">
                  <p>{{ t('original_duration') }}: {{ processedVideo.duration }}s</p>
                  <p>{{ t('new_duration') }}: {{ processedVideo.duration }}s</p>
                </div>

                <UButton @click="downloadVideo" variant="outline" class="w-full">
                  <UIcon name="i-heroicons-arrow-down-tray" class="mr-2" />
                  {{ t('download') }}
                </UButton>
              </div>
            </div>
          </UCard>
        </BaseShinyCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any custom styles if needed */
</style>
