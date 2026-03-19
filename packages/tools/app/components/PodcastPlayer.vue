<script lang="ts" setup>
import WaveSurfer from 'wavesurfer.js'

const { currentEpisode, isPlaying, currentTime, audioUrl, podcastInfo, togglePlay, stop, setCurrentTime } = usePodcastPlayer()

const containerRef = ref<HTMLElement | null>(null)
const wavesurfer = ref<WaveSurfer | null>(null)
const duration = ref(0)
const playbackRate = ref(1)
const hasError = ref(false)
const isLoading = ref(false)

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const initWaveSurfer = async () => {
  if (!containerRef.value || !audioUrl.value) return

  isLoading.value = true
  hasError.value = false
  if (wavesurfer.value) {
    wavesurfer.value.destroy()
    wavesurfer.value = null
  }

  wavesurfer.value = WaveSurfer.create({
    container: containerRef.value,
    waveColor: '#f97316',
    progressColor: '#ea6c0a',
    cursorColor: '#f97316',
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: 48,
    normalize: true,
    url: audioUrl.value,
  })

  wavesurfer.value.on('ready', () => {
    duration.value = wavesurfer.value?.getDuration() || 0
    isLoading.value = false
    wavesurfer.value?.play()
  })

  wavesurfer.value.on('timeupdate', (time: number) => {
    setCurrentTime(time)
  })

  wavesurfer.value.on('play', () => { isPlaying.value = true })
  wavesurfer.value.on('pause', () => { isPlaying.value = false })

  wavesurfer.value.on('decodeError', () => {
    isLoading.value = false
    hasError.value = true
    isPlaying.value = false
    useToast().add({
      title: 'Episode Unavailable',
      description: 'This episode could not be loaded. Please try another.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  })

  wavesurfer.value.on('mediaError', () => {
    isLoading.value = false
    hasError.value = true
    isPlaying.value = false
    useToast().add({
      title: 'Episode Unavailable',
      description: 'This episode could not be loaded. Please try another.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  })

  wavesurfer.value.on('finish', () => {
    isPlaying.value = false
  })
}

watch(audioUrl, (newUrl) => {
  if (newUrl) initWaveSurfer()
})

onMounted(() => {
  if (audioUrl.value) initWaveSurfer()
})

onUnmounted(() => {
  wavesurfer.value?.destroy()
})

watch(isPlaying, (playing) => {
  if (!wavesurfer.value || isLoading.value) return
  if (playing) { wavesurfer.value.play() } else { wavesurfer.value.pause() }
})

function handleTogglePlay() {
  if (hasError.value) {
    useToast().add({
      title: 'Episode Unavailable',
      description: 'This episode could not be loaded. Please try another.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
    return
  }
  if (isLoading.value) return
  togglePlay()
}

function handleSkip(seconds: number) {
  wavesurfer.value?.skip(seconds)
}

function handleSetRate(rate: number) {
  playbackRate.value = rate
  wavesurfer.value?.setPlaybackRate(rate)
}

function handleClose() {
  if (wavesurfer.value) {
    wavesurfer.value.destroy()
    wavesurfer.value = null
  }
  stop()
  audioUrl.value = ''
  currentEpisode.value = null
  podcastInfo.value = null
  duration.value = 0
  currentTime.value = 0
  hasError.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="currentEpisode" class="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-orange-500/30 bg-background-foreground shadow-2xl shadow-black/50 p-4 space-y-3">
      <div class="flex items-center gap-3">
        <img
          v-if="podcastInfo?.artwork"
          :src="podcastInfo.artwork"
          :alt="podcastInfo.title"
          class="w-10 h-10 rounded object-cover shrink-0"
          loading="lazy"
        >
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-white truncate">{{ currentEpisode.title }}</p>
          <p class="text-xs text-gray-500 truncate">{{ podcastInfo?.title }}</p>
        </div>
        <UButton
          :icon="isLoading ? 'i-lucide-loader-2' : (isPlaying ? 'i-lucide-pause' : 'i-lucide-play')"
          color="primary"
          size="sm"
          class="rounded-full shrink-0"
          :disabled="isLoading || hasError"
          @click="handleTogglePlay"
        />
        <UButton icon="i-lucide-x" variant="ghost" size="sm" class="shrink-0" @click="handleClose" />
      </div>

      <div v-if="hasError" class="text-xs text-red-400 text-center py-1">
        Episode unavailable
      </div>

      <div v-else>
        <div ref="containerRef" class="w-full" :class="{ 'opacity-50': isLoading }" />
        <div class="flex items-center justify-between text-xs font-mono text-gray-500 mt-1">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <UButton variant="ghost" size="xs" icon="i-lucide-rotate-rewind" @click="handleSkip(-10)" />
          <UButton variant="ghost" size="xs" icon="i-lucide-rotate-ccw" @click="handleSkip(10)" />
        </div>
        <USelect v-model="playbackRate" :items="[
          { value: 0.5, label: '0.5x' },
          { value: 1, label: '1.0x' },
          { value: 1.5, label: '1.5x' },
          { value: 2, label: '2.0x' }
        ]" value-key="value" label-key="label" size="xs" class="w-20"
          @update:model-value="(val: number) => handleSetRate(val)" />
      </div>
    </div>
  </Teleport>
</template>
