<script lang="ts" setup>
/**
 *
 * Component Description: AudioPlayer component with waveform visualization using WaveSurfer
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import WaveSurfer from 'wavesurfer.js'

interface Props {
  audioData: ArrayBuffer
  currentTime: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'timeUpdate', time: number): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const wavesurfer = ref<WaveSurfer | null>(null)
const isPlaying = ref(false)
const duration = ref(0)
const playbackRate = ref(1)
const hasError = ref(false)

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

onMounted(async () => {
  if (!containerRef.value) return

  wavesurfer.value = WaveSurfer.create({
    container: containerRef.value,
    waveColor: '#10b981',
    progressColor: '#059669',
    cursorColor: '#34d399',
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: 60,
    normalize: true,
  })

  const blob = new Blob([props.audioData])
  const url = URL.createObjectURL(blob)

  await wavesurfer.value.load(url)

  wavesurfer.value.on('ready', () => {
    duration.value = wavesurfer.value?.getDuration() || 0
  })

  wavesurfer.value.on('timeupdate', (time: number) => {
    emit('timeUpdate', time)
  })

  wavesurfer.value.on('interaction', () => {
    emit('timeUpdate', wavesurfer.value?.getCurrentTime() || 0)
  })

  wavesurfer.value.on('play', () => { isPlaying.value = true })
  wavesurfer.value.on('pause', () => { isPlaying.value = false })

  wavesurfer.value.on('decodeError', () => {
    hasError.value = true
    isPlaying.value = false
    useToast().add({
      title: 'Audio Error',
      description: 'Could not decode this audio file.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  })

  wavesurfer.value.on('mediaError', () => {
    hasError.value = true
    isPlaying.value = false
    useToast().add({
      title: 'Audio Error',
      description: 'This audio file could not be played.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  })
})

watch(() => props.currentTime, (newTime) => {
  if (wavesurfer.value && Math.abs(wavesurfer.value.getCurrentTime() - newTime) > 0.5) {
    wavesurfer.value.seekTo(newTime / duration.value)
  }
})

watch(() => props.audioData, async () => {
  if (!wavesurfer.value) return

  const blob = new Blob([props.audioData])
  const url = URL.createObjectURL(blob)
  await wavesurfer.value.load(url)
})

onUnmounted(() => {
  wavesurfer.value?.destroy()
})

function togglePlay() {
  wavesurfer.value?.playPause()
}

function skip(seconds: number) {
  wavesurfer.value?.skip(seconds)
}

function setPlaybackRate(rate: number) {
  playbackRate.value = rate
  wavesurfer.value?.setPlaybackRate(rate)
}
</script>

<template>
  <div class=" border border-white/0 rounded-2xl p-6 flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <UButton :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" color="success" size="lg" class="rounded-full"
          :disabled="hasError" @click="togglePlay" />
        <div>
          <div class="text-sm font-mono ">
            {{ formatTime(currentTime) }} <span class="text-gray-500">/ {{ formatTime(duration) }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 text-gray-400">
        <UButton variant="ghost" size="sm" icon="i-lucide-rewind" @click="skip(-10)" />
        <UButton variant="ghost" size="sm" icon="i-lucide-rotate-ccw" @click="skip(10)" />
        <USelect v-model="playbackRate" :items="[
          { value: 0.5, label: '0.5x' },
          { value: 1, label: '1.0x' },
          { value: 1.5, label: '1.5x' },
          { value: 2, label: '2.0x' }
        ]" value-key="value" label-key="label" size="sm" class="w-20"
          @update:model-value="(val: number) => setPlaybackRate(val)" />
      </div>
    </div>
    <div ref="containerRef" class="w-full" />
  </div>
</template>
