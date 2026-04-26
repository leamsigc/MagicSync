<!--  Translation file -->
<i18n src="./MicRecorder.json"></i18n>
<script lang="ts" setup>
/**
 * Component Description: Mic recorder with device selection
 * Based on elevenlabs-ui-vue mic-selector pattern
 */

const { t } = useI18n()

interface Props {
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  (e: 'transcript', text: string): void
  (e: 'recording-start'): void
  (e: 'recording-stop', blob: Blob): void
  (e: 'error', error: string): void
}>()

const toast = useToast()

const isDropdownOpen = ref(false)

// Composable state
const { devices, loading: devicesLoading, error: devicesError, hasPermission, selectedDeviceId, selectDevice, requestPermission } = useAudioDevices()
const { isRecording, duration, audioBlob, startRecording, stopRecording, reset } = useAudioRecorder()
const { isProcessing: isTranscribing, processingProgress, processingStatus, isModelLoading, activeProject, addProject, setActiveProject } = useProject()

// Derived states
const currentDevice = computed(() =>
  devices.value.find(d => d.deviceId === selectedDeviceId.value) || devices.value[0] || {
    label: devicesLoading.value ? t('micRecorder.loading') : t('micRecorder.noMicrophone'),
    deviceId: '',
  }
)

const hasRecording = computed(() => !!audioBlob.value)
const hasTranscript = computed(() => activeProject.value?.status == 'completed')
const transcriptText = computed(() =>
  activeProject.value?.partialText
)
const transcriptionComplete = computed(() => processingProgress.value === 100 && hasTranscript.value)

const statusLabel = computed(() => {
  if (isModelLoading.value) return t('micRecorder.loadingAiModel')
  if (processingStatus.value) return processingStatus.value
  if (isTranscribing.value) return t('micRecorder.transcribing')
  return ''
})

// Actions
const handleDropdownOpen = async (open: boolean) => {
  isDropdownOpen.value = open
  if (open && !hasPermission.value && !devicesLoading.value) {
    await requestPermission()
  }
}

const handleStartRecording = async () => {
  try {
    reset()
    emit('recording-start')
    await startRecording(selectedDeviceId.value || undefined)
  } catch (err) {
    emit('error', err instanceof Error ? err.message : 'Failed to start recording')
  }
}

const handleStopRecording = async () => {
  try {
    await stopRecording()
    emit('recording-stop', audioBlob.value as Blob)
  } catch (err) {
    emit('error', err instanceof Error ? err.message : 'Failed to stop recording')
  }
}

const handleTranscribe = async () => {
  if (!audioBlob.value) return
  try {
    const file = new File([audioBlob.value], 'recording.webm', { type: 'audio/webm' })
    await addProject(file, 'onnx-community/whisper-tiny', 'en')
  } catch (err) {
    emit('error', err instanceof Error ? err.message : 'Transcription failed')
    toast.add({ title: 'Transcription failed', icon: 'i-heroicons-exclamation-triangle', color: 'error' })
  }
}

const handleReRecord = () => {
  reset()
}

const handleUseTranscript = () => {
  console.log({ activeProject: activeProject.value });

  if (transcriptText.value) {
    emit('transcript', transcriptText.value)
    toast.add({ title: 'Transcript added', icon: 'i-heroicons-check-circle', color: 'success' })
    reset()
    setActiveProject(null)
  }
}

// Watch for transcription completion
watch(transcriptionComplete, (complete) => {
  if (complete) {
    handleUseTranscript()
  }
})


onUnmounted(() => reset())
</script>

<template>
  <UPopover v-model:open="isDropdownOpen" :disabled="disabled" @update:open="handleDropdownOpen">
    <UButton variant="ghost" size="sm"
      :class="['flex items-center gap-2', isRecording ? 'text-red-500 animate-pulse' : 'text-zinc-400 hover:text-zinc-200']"
      :disabled="disabled || devicesLoading">
      <UIcon name="i-lucide-mic" class="w-4 h-4" />
      <span class="text-xs hidden sm:inline">{{ currentDevice.label }}</span>
    </UButton>

    <template #content>
      <div class="w-72 p-3 space-y-3">
        <!-- Loading devices -->
        <div v-if="devicesLoading" class="text-sm text-zinc-500 py-2">
          {{ t('micRecorder.loadingDevices') }}
        </div>

        <!-- Device error -->
        <div v-else-if="devicesError" class="text-sm text-red-500 py-2">
          {{ devicesError }}
        </div>

        <!-- Permission needed -->
        <div v-else-if="!hasPermission" class="space-y-2">
          <p class="text-sm text-zinc-400">{{ t('micRecorder.microphoneAccessRequired') }}</p>
          <UButton block color="primary" @click="() => { requestPermission() }">
            {{ t('micRecorder.grantPermission') }}
          </UButton>
        </div>

        <!-- Main content -->
        <template v-else>
          <!-- Device Selection -->
          <div class="space-y-1">
            <label class="text-xs text-zinc-500 uppercase tracking-wider">{{ t('micRecorder.selectMicrophone') }}</label>
            <div class="max-h-32 overflow-y-auto space-y-1">
              <div v-for="device in devices" :key="device.deviceId"
                class="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors"
                :class="selectedDeviceId === device.deviceId ? 'bg-primary/20 text-primary' : 'hover:bg-zinc-800'"
                @click="selectDevice(device.deviceId)">
                <span class="text-sm truncate">{{ device.label }}</span>
                <UIcon v-if="selectedDeviceId === device.deviceId" name="i-lucide-check" class="w-4 h-4" />
              </div>
            </div>
          </div>

          <!-- Recording Actions -->
          <div class="border-t border-zinc-700 pt-3 space-y-3">

            <!-- Idle: Start Recording -->
            <UButton v-if="!isRecording && !hasRecording && !hasTranscript" block color="primary" icon="i-lucide-mic"
              @click="handleStartRecording">
              {{ t('micRecorder.startRecording') }}
            </UButton>

            <!-- Recording: Stop -->
            <div v-if="isRecording" class="space-y-3">
              <div class="flex items-center justify-center gap-2">
                <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span class="text-lg font-mono text-red-400">{{ String(Math.floor(duration / 60)).padStart(2, '0') }}:{{
                  String(duration % 60).padStart(2, '0') }}</span>
              </div>
              <UButton block color="error" variant="solid" icon="i-lucide-square" @click="handleStopRecording">
                {{ t('micRecorder.stopRecording') }}
              </UButton>
            </div>

            <!-- Recorded: Transcribe -->
            <template v-if="!isRecording && hasRecording && !hasTranscript && !isTranscribing">
              <div class="text-center p-2 rounded-lg bg-zinc-900">
                <span class="text-sm text-zinc-400">{{ t('micRecorder.recordingReady') }}</span>
              </div>
              <UButton block color="primary" icon="i-lucide-file-text" @click="handleTranscribe">
                {{ t('micRecorder.transcribeAudio') }}
              </UButton>
            </template>

            <!-- Transcribing: Progress -->
            <div v-if="isTranscribing" class="space-y-2">
              <label class="text-xs text-zinc-500 uppercase tracking-wider">{{ t('micRecorder.transcribing') }}</label>
              <div class="p-3 rounded-lg bg-zinc-900 space-y-2">
                <div class="flex items-center gap-2">
                  <UIcon :name="isModelLoading ? 'i-lucide-brain' : 'i-lucide-waveform'"
                    :class="['w-4 h-4 animate-pulse', isModelLoading ? 'text-yellow-500' : 'text-green-500']" />
                  <span class="text-sm text-zinc-400">{{ statusLabel }}</span>
                </div>
                <UProgress :value="processingProgress" color="success" :animated="true" />
              </div>
            </div>

            <!-- Transcript Ready -->
            <template v-if="!isRecording && hasTranscript">
              <label class="text-xs text-zinc-500 uppercase tracking-wider">{{ t('micRecorder.transcript') }}</label>
              <div class="max-h-32 overflow-y-auto p-2 rounded-lg bg-zinc-900 text-sm text-zinc-300">
                {{ transcriptText }}
              </div>
              <div class="flex gap-2">
                <UButton flex-1 color="primary" icon="i-lucide-check" @click="handleUseTranscript">
                  {{ t('micRecorder.useTranscript') }}
                </UButton>
                <UButton flex-1 variant="outline" color="neutral" icon="i-lucide-refresh-cw" @click="handleReRecord">
                  {{ t('micRecorder.reRecord') }}
                </UButton>
              </div>
            </template>
          </div>
        </template>
      </div>
    </template>
  </UPopover>
</template>
