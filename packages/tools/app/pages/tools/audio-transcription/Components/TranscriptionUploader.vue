<script setup lang="ts">
/**
 *
 * Component Description: Upload interface for adding audio files (drag/drop, URL, record)
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { ref } from 'vue'

const props = defineProps<{
  modelValue: 'file' | 'url' | 'record'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: 'file' | 'url' | 'record'): void
  (e: 'files-added', files: FileList | File[]): void
}>()

const audioUrl = ref('')
const isDragging = ref(false)
const isRecording = ref(false)
const recordingStream = ref<MediaStream | null>(null)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

const activeTab = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const tabs = [
  { label: 'Upload File', value: 'file', icon: 'i-lucide-upload-cloud', slot: 'file' as const },
  { label: 'Import from URL', value: 'url', icon: 'i-lucide-link', slot: 'url' as const },
  { label: 'Record Audio', value: 'record', icon: 'i-lucide-mic', slot: 'record' as const }
]

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  if (e.dataTransfer?.files) {
    emit('files-added', e.dataTransfer.files)
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) {
    emit('files-added', target.files)
    target.value = ''
  }
}

function openFilePicker() {
  fileInputRef.value?.click()
}

async function loadFromUrl() {
  if (!audioUrl.value) return
  try {
    const response = await fetch(audioUrl.value)
    const blob = await response.blob()
    const file = new File([blob], 'audiofromurl', { type: blob.type })
    emit('files-added', [file])
    audioUrl.value = ''
  } catch (error) {
    console.error('Failed to load audio from URL:', error)
  }
}

async function startRecording() {
  try {
    recordingStream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(recordingStream.value)
    recordedChunks.value = []

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.value.push(e.data)
      }
    }

    mediaRecorder.value.onstop = () => {
      const blob = new Blob(recordedChunks.value, { type: 'audio/webm' })
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
      emit('files-added', [file])
    }

    mediaRecorder.value.start()
    isRecording.value = true
  } catch (error) {
    console.error('Failed to start recording:', error)
  }
}

function stopRecording() {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    if (recordingStream.value) {
      recordingStream.value.getTracks().forEach(track => track.stop())
      recordingStream.value = null
    }
  }
}
</script>

<template>
  <div v-motion-slide-bottom
    class="mt-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
    <UTabs v-model="activeTab" :items="tabs">
      <template #default="{ item }">
        <div class="flex items-center gap-2">
          <span class="font-medium tracking-tight">{{ item.label }}</span>
        </div>
      </template>

      <template #file>
        <div :class="[
          'border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer mt-6',
          isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
        ]" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop" @click="openFilePicker">
          <input ref="fileInputRef" type="file" accept="audio/*,video/*" multiple class="hidden"
            @change="handleFileSelect">
          <UIcon name="i-lucide-headphones" class="text-5xl text-primary-500 dark:text-primary-400 mb-4 mx-auto" />
          <p class="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">Drag and drop audio files
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">or click to browse your computer</p>
          <div class="flex gap-2 justify-center">
            <UBadge color="gray" variant="soft" class="font-mono text-[10px] font-bold uppercase tracking-widest">MP3
            </UBadge>
            <UBadge color="gray" variant="soft" class="font-mono text-[10px] font-bold uppercase tracking-widest">WAV
            </UBadge>
            <UBadge color="gray" variant="soft" class="font-mono text-[10px] font-bold uppercase tracking-widest">M4A
            </UBadge>
            <UBadge color="gray" variant="soft" class="font-mono text-[10px] font-bold uppercase tracking-widest">MP4
            </UBadge>
          </div>
        </div>
      </template>

      <template #url>
        <div class="mt-6 flex gap-4 max-w-2xl mx-auto py-12">
          <UInput v-model="audioUrl" placeholder="https://example.com/audio.mp3" icon="i-lucide-link" size="xl"
            class="flex-1 font-mono text-sm" />
          <UButton :disabled="!audioUrl" color="primary" size="xl" @click="loadFromUrl">
            Import
          </UButton>
        </div>
      </template>

      <template #record>
        <div
          class="text-center py-16 mt-6 max-w-xl mx-auto bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <UButton v-if="!isRecording" color="primary" size="xl"
            class="rounded-full px-8 shadow-lg shadow-primary-500/20" @click="startRecording">
            <UIcon name="i-lucide-mic" class="mr-2 text-xl" />
            Start Recording
          </UButton>
          <div v-else class="space-y-6 flex flex-col items-center">
            <div
              class="flex items-center gap-3 bg-red-50 dark:bg-red-900/10 px-6 py-3 rounded-full border border-red-200 dark:border-red-900/20">
              <span class="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm" />
              <span class="text-red-500 font-bold tracking-widest uppercase text-sm">Recording in progress</span>
            </div>

            <div class="flex gap-1 items-center h-12">
              <div v-for="i in 10" :key="i" class="w-1.5 bg-red-500 rounded-full animate-bounce"
                :style="{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s` }" />
            </div>

            <UButton color="neutral" variant="outline" size="xl"
              class="rounded-full px-8 active:scale-95 transition-transform" icon="i-lucide-square"
              @click="stopRecording">
              Stop Recording
            </UButton>
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>
