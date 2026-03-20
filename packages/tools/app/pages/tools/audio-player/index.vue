<script lang="ts" setup>
/**
 * Audio Player Tool
 * Play audio files with waveform visualization
 *
 * @author Local Monorepo Team
 * @version 0.0.1
 */



useHead({
  title: 'Audio Player - Play audio with waveform visualization',
  meta: [
    { name: 'description', content: 'Play audio files with waveform visualization' }
  ]
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const audioData = ref<ArrayBuffer | null>(null)
const currentTime = ref(0)

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) {
    const file = input.files[0]
    selectedFile.value = file
    audioData.value = await file.arrayBuffer()
    currentTime.value = 0
  }
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('audio/')) {
    selectedFile.value = file
    audioData.value = await file.arrayBuffer()
    currentTime.value = 0
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const clearFile = () => {
  selectedFile.value = null
  audioData.value = null
  currentTime.value = 0
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const handleTimeUpdate = (time: number) => {
  currentTime.value = time
}
</script>

<template>
  <div class="min-h-screen bg-background-foreground">
    <BaseHeader />
    <main class="container mx-auto px-4 py-8 max-w-5xl">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Audio Player</h1>
        <p class="text-gray-400">Play audio files with waveform visualization</p>
      </div>

      <div class="mb-8">
        <div
          class="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center cursor-pointer transition-colors hover:border-emerald-500 hover:bg-emerald-500/5"
          @click="fileInputRef?.click()" @drop="handleDrop" @dragover="handleDragOver">
          <input ref="fileInputRef" type="file" accept="audio/*" class="hidden" @change="handleFileSelect">
          <UIcon name="i-lucide-music" class="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p class="text-lg text-gray-300 mb-2">Drop your audio file here or click to browse</p>
          <p class="text-sm text-gray-500">Supports MP3, WAV, OGG, FLAC, M4A and more</p>
        </div>

        <div v-if="selectedFile" class="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-file-audio" class="w-6 h-6 text-emerald-500" />
              <div>
                <p class="text-sm font-medium text-white">{{ selectedFile.name }}</p>
                <p class="text-xs text-gray-500">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</p>
              </div>
            </div>
            <UButton variant="ghost" size="sm" icon="i-lucide-x" @click="clearFile" />
          </div>
        </div>
      </div>

      <AudioPlayer v-if="audioData" :audio-data="audioData" :current-time="currentTime"
        @time-update="handleTimeUpdate" />

      <div v-else class="border border-gray-700/50 rounded-2xl p-12 text-center">
        <UIcon name="i-lucide-headphones" class="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p class="text-gray-500">Upload an audio file to get started</p>
      </div>

      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <BaseShinyCard title="Waveform Visualization"
          description="See your audio as an interactive waveform with precise seeking" icon="i-lucide-audio-waveform" />
        <BaseShinyCard title="Playback Controls" description="Full control: play, pause, seek, and speed adjustment"
          icon="i-lucide-sliders" />
        <BaseShinyCard title="Local Playback" description="Process audio files locally in your browser"
          icon="i-lucide-file-audio" />
      </div>
    </main>
    <BaseFooter />
  </div>
</template>
