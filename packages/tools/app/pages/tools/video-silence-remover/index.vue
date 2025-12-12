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

// Video recording state
const showRecordingModal = ref(false)
const recordingStream = ref<MediaStream | null>(null)
const recordingVideo = ref<HTMLVideoElement | null>(null)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])
const isRecording = ref(false)
const isPaused = ref(false)
const isMuted = ref(false)
const selectedCamera = ref<string>('')
const selectedAspectRatio = ref<'16:9' | '9:16' | '1:1'>('16:9')
const availableCameras = ref<MediaDeviceInfo[]>([])
const recordingDuration = ref(0)
const recordingTimer = ref<NodeJS.Timeout | null>(null)

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

// Video recording functions
const openRecordingModal = async () => {
  showRecordingModal.value = true
  await initializeRecording()
}

const closeRecordingModal = () => {
  stopRecording()
  showRecordingModal.value = false
  cleanupRecording()
}

const initializeRecording = async () => {
  try {
    // Get available cameras
    const devices = await navigator.mediaDevices.enumerateDevices()
    availableCameras.value = devices.filter(device => device.kind === 'videoinput')

    // Default to first camera
    if (availableCameras.value.length > 0) {
      // @ts-ignore
      selectedCamera.value = availableCameras.value[0]?.deviceId
    }

    await startCameraStream()
  } catch (error) {
    console.error('Failed to initialize recording:', error)
    toast.add({
      title: t('error'),
      description: t('camera_access_required'),
      color: 'error'
    })
  }
}

const startCameraStream = async () => {
  try {
    // Set video constraints based on aspect ratio
    let videoConstraints: MediaTrackConstraints = {
      deviceId: selectedCamera.value ? { exact: selectedCamera.value } : undefined,
    }

    // Set ideal resolution based on aspect ratio
    switch (selectedAspectRatio.value) {
      case '16:9':
        videoConstraints.width = { ideal: 1920 }
        videoConstraints.height = { ideal: 1080 }
        break
      case '9:16':
        // For portrait, request taller than wide
        videoConstraints.width = { ideal: 720 }
        videoConstraints.height = { ideal: 1280 }
        break
      case '1:1':
        videoConstraints.width = { ideal: 1080 }
        videoConstraints.height = { ideal: 1080 }
        break
    }

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: true
    }

    recordingStream.value = await navigator.mediaDevices.getUserMedia(constraints)

    // Apply aspect ratio cropping if needed
    await applyAspectRatioCropping()

    if (recordingVideo.value) {
      recordingVideo.value.srcObject = recordingStream.value
      // Preview is always muted to avoid audio feedback
      recordingVideo.value.muted = true
    }
  } catch (error) {
    console.error('Failed to start camera stream:', error)
    toast.add({
      title: t('error'),
      description: t('permission_denied'),
      color: 'error'
    })
  }
}

const applyAspectRatioCropping = async () => {
  if (!recordingStream.value) return

  const videoTrack = recordingStream.value.getVideoTracks()[0]
  if (!videoTrack) return

  const capabilities = videoTrack.getCapabilities()
  const settings = videoTrack.getSettings()

  // Apply cropping constraints based on aspect ratio
  const newConstraints: MediaTrackConstraints = {
    deviceId: selectedCamera.value ? { exact: selectedCamera.value } : undefined,
  }

  switch (selectedAspectRatio.value) {
    case '16:9':
      newConstraints.width = { ideal: 1920 }
      newConstraints.height = { ideal: 1080 }
      newConstraints.aspectRatio = 16 / 9
      break
    case '9:16':
      newConstraints.width = { ideal: 720 }
      newConstraints.height = { ideal: 1280 }
      newConstraints.aspectRatio = 9 / 16
      break
    case '1:1':
      newConstraints.width = { ideal: 1080 }
      newConstraints.height = { ideal: 1080 }
      newConstraints.aspectRatio = 1
      break
  }

  try {
    await videoTrack.applyConstraints(newConstraints)
  } catch (error) {
    console.warn('Could not apply aspect ratio constraints:', error)
    // Continue without cropping - the video will maintain its natural aspect ratio
  }
}

const changeCamera = async (deviceId: string) => {
  selectedCamera.value = deviceId
  if (recordingStream.value) {
    recordingStream.value.getTracks().forEach(track => track.stop())
    recordingStream.value = null
  }
  await startCameraStream()
}

const changeAspectRatio = async (aspectRatio: '16:9' | '9:16' | '1:1') => {
  selectedAspectRatio.value = aspectRatio
  // Reapply aspect ratio constraints to the active video track
  await applyAspectRatioCropping()
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
  if (recordingStream.value) {
    recordingStream.value.getAudioTracks().forEach(track => {
      track.enabled = !isMuted.value
    })
  }
  // Preview video is always muted to avoid audio feedback
  if (recordingVideo.value) {
    recordingVideo.value.muted = true
  }
}

const startRecording = () => {
  if (!recordingStream.value) return

  // Try different mime types in order of preference
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=h264',
    'video/webm',
    'video/mp4',
    '' // Let browser choose default
  ]

  let selectedMimeType = ''
  for (const mimeType of mimeTypes) {
    if (!mimeType || MediaRecorder.isTypeSupported(mimeType)) {
      selectedMimeType = mimeType
      break
    }
  }

  if (!selectedMimeType && !MediaRecorder.isTypeSupported('')) {
    toast.add({
      title: t('error'),
      description: 'Recording is not supported in this browser',
      color: 'error'
    })
    return
  }

  recordedChunks.value = []
  const options: MediaRecorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {}
  mediaRecorder.value = new MediaRecorder(recordingStream.value, options)

  mediaRecorder.value.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.value.push(event.data)
    }
  }

  mediaRecorder.value.onstop = () => {
    const mimeType = selectedMimeType || 'video/webm'
    const blob = new Blob(recordedChunks.value, { type: mimeType })
    const url = URL.createObjectURL(blob)
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([blob], `recorded-video-${Date.now()}.${extension}`, { type: mimeType })

    // Set as selected video
    uploadedVideo.value = [file]
    videoUrl.value = url
    processedVideo.value = null

    closeRecordingModal()
    toast.add({
      title: t('success'),
      description: 'Video recorded successfully',
      color: 'success'
    })
  }

  mediaRecorder.value.start()
  isRecording.value = true
  isPaused.value = false
  recordingDuration.value = 0

  // Start timer
  recordingTimer.value = setInterval(() => {
    recordingDuration.value++
  }, 1000)
}
const pauseRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    if (isPaused.value) {
      mediaRecorder.value.resume()
      isPaused.value = false
      // Resume timer
      recordingTimer.value = setInterval(() => {
        recordingDuration.value++
      }, 1000)
    } else {
      mediaRecorder.value.pause()
      isPaused.value = true
      // Pause timer
      if (recordingTimer.value) {
        clearInterval(recordingTimer.value)
        recordingTimer.value = null
      }
    }
  }
}

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    isPaused.value = false

    // Clear timer
    if (recordingTimer.value) {
      clearInterval(recordingTimer.value)
      recordingTimer.value = null
    }
  }
}

const cleanupRecording = () => {
  if (recordingStream.value) {
    recordingStream.value.getTracks().forEach(track => track.stop())
    recordingStream.value = null
  }
  if (recordingVideo.value) {
    recordingVideo.value.srcObject = null
  }
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
  mediaRecorder.value = null
  recordedChunks.value = []
  isRecording.value = false
  isPaused.value = false
  recordingDuration.value = 0
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
                <UButton variant="outline" class="flex-1" @click="openRecordingModal">
                  <Icon name="i-heroicons-video-camera" class="mr-2" />
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
                  <Icon name="i-heroicons-trash" class="mr-2" />
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
                <Icon name="i-heroicons-scissors" class="mr-2" />
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
                <Icon name="i-heroicons-check-circle" class="mx-auto h-12 w-12 text-green-400 mb-4" />
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
                  <Icon name="i-heroicons-arrow-down-tray" class="mr-2" />
                  {{ t('download') }}
                </UButton>
              </div>
            </div>
          </UCard>
        </BaseShinyCard>
      </div>
    </div>

    <!-- Video Recording Modal -->
    <UModal v-model:open="showRecordingModal" @close="closeRecordingModal" size="xl" fullscreen>
      <template #content>
        <div class="flex flex-col items-center justify-center h-full p-4 ">
          <div
            class="relative flex flex-col items-center justify-center  transition-all duration-500 ease-in-out bg-black rounded-xl  overflow-hidden mx-auto w-full "
            :class="{
              'max-w-5xl aspect-video': selectedAspectRatio === '16:9',
              'max-w-[400px] aspect-[9/16]': selectedAspectRatio === '9:16',
              'max-w-[600px] aspect-square': selectedAspectRatio === '1:1',
            }">

            <div class="relative w-full h-full bg-black group">
              <!-- Recording Video -->
              <video ref="recordingVideo" autoplay playsinline muted="true"
                class="w-full h-full object-cover transition-transform duration-500 opacity-100"></video>

              <!-- Recording Indicator -->
              <div v-if="isRecording" class="absolute top-4 left-4 flex items-center space-x-2">
                <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span class="text-white text-sm font-medium">{{ formatDuration(recordingDuration) }}</span>
              </div>

              <!-- Bottom Controls -->
              <div class="absolute bottom-4 left-0 right-0 flex flex-col items-center space-y-4 ">
                <!-- Aspect Ratio & Voice Mode -->
                <div class="flex items-center space-x-2 p-1 bg-neutral-900/50 rounded-full backdrop-blur-sm">
                  <div class="flex space-x-1 ">
                    <UButton :variant="selectedAspectRatio === '16:9' ? 'soft' : 'ghost'" size="xs"
                      @click="changeAspectRatio('16:9')"
                      class="text-xs px-4 rounded-full  h-8 grid place-content-center" rounded>
                      16:9
                    </UButton>
                    <UButton :variant="selectedAspectRatio === '9:16' ? 'soft' : 'ghost'" size="xs" rounded
                      @click="changeAspectRatio('9:16')"
                      class="text-xs px-4 rounded-full  h-8 grid place-content-center">
                      9:16
                    </UButton>
                    <UButton :variant="selectedAspectRatio === '1:1' ? 'soft' : 'ghost'" size="xs" rounded
                      @click="changeAspectRatio('1:1')"
                      class="text-xs px-4 rounded-full  h-8 grid place-content-center">
                      1:1
                    </UButton>
                  </div>
                </div>

                <!-- Recording Controls -->
                <div class="flex items-center space-x-4">
                  <UButton :variant="isMuted ? 'soft' : 'outline'" color="neutral" @click="toggleMute" size="lg" rounded
                    class="w-14 h-14 grid place-content-center rounded-full">
                    <Icon :name="isMuted ? 'lucide:mic-off' : 'lucide:mic'" size="24" />
                  </UButton>

                  <UButton icon="" v-if="!isRecording" color="error" @click="startRecording" size="xl" rounded
                    class="w-20 h-20 grid place-content-center rounded-full border-4 border-white/50 animate-pulse text-white">
                    <Icon name="lucide:play" size="26" />
                  </UButton>

                  <UButton icon="" v-else-if="!isPaused" color="error" @click="pauseRecording" size="xl" rounded
                    class="w-20 h-20 grid place-content-center rounded-full border-4 border-white/50 animate-pulse text-white">
                    <Icon name="lucide:pause" />
                  </UButton>

                  <UButton icon="" v-else color="error" @click="pauseRecording" size="xl" rounded
                    class="w-20 h-20 grid place-content-center rounded-full border-4 border-white/50 text-white">
                    <Icon name="lucide:play" size="20" />
                  </UButton>

                  <UButton icon="" color="neutral" @click="changeCamera(selectedCamera)" size="lg" rounded
                    class="w-14 h-14 grid place-content-center rounded-full text-red-700 ">
                    <Icon name="fluent:record-stop-12-filled" size="32" />
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* Custom aspect ratio classes */
.w-45 {
  width: 11.25rem;
  /* 180px */
}

.h-45 {
  height: 11.25rem;
  /* 180px */
}
</style>
