<i18n src="../pages/tools/podcast/index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * PodcastPlayer — global mini-player with episode list and offline download
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import WaveSurfer from 'wavesurfer.js'

const { t } = useI18n()
const {
  currentEpisode, isPlaying, currentTime, proxiedAudioUrl, podcastInfo,
  podcastEpisodes, isDownloaded, isDownloading,
  togglePlay, setCurrentTime, clearAudio, playEpisode, saveForOffline, removeOffline,
} = usePodcastPlayer()

const containerRef = ref<HTMLElement | null>(null)
const wavesurfer = ref<WaveSurfer | null>(null)
const duration = ref(0)
const playbackRate = ref(1)
const hasError = ref(false)
const isLoading = ref(false)
const showEpisodes = ref(false)

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const initWaveSurfer = async () => {
  if (!containerRef.value || !proxiedAudioUrl.value) return

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
    barWidth: 1,
    barGap: 1,
    barRadius: 2,
    height: 60,
    normalize: false,
    url: proxiedAudioUrl.value,
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
      title: t('podcast.player.episodeUnavailable'),
      description: t('podcast.player.episodeUnavailableBody'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  })

  wavesurfer.value.on('mediaError', () => {
    isLoading.value = false
    hasError.value = true
    isPlaying.value = false
    useToast().add({
      title: t('podcast.player.episodeUnavailable'),
      description: t('podcast.player.episodeUnavailableBody'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  })

  wavesurfer.value.on('finish', () => {
    isPlaying.value = false
  })
}

watch(proxiedAudioUrl, (newUrl) => {
  if (newUrl) initWaveSurfer()
})

onMounted(() => {
  if (proxiedAudioUrl.value) initWaveSurfer()
})

onUnmounted(() => {
  wavesurfer.value?.destroy()
})

watch(isPlaying, (playing) => {
  if (!wavesurfer.value || isLoading.value) return
  if (playing) { wavesurfer.value.play() } else { wavesurfer.value.pause() }
})

const handleTogglePlay = () => {
  if (hasError.value || isLoading.value) return
  togglePlay()
}

const handleSkip = (seconds: number) => {
  wavesurfer.value?.skip(seconds)
}

const handleSetRate = (rate: number) => {
  playbackRate.value = rate
  wavesurfer.value?.setPlaybackRate(rate)
}

const handleClose = () => {
  if (wavesurfer.value) {
    wavesurfer.value.destroy()
    wavesurfer.value = null
  }
  clearAudio()
  duration.value = 0
  hasError.value = false
  showEpisodes.value = false
}

const handleSwitchEpisode = (episode: { id: string; title: string; date: string; duration: string; audioUrl: string; description: string }) => {
  if (!podcastInfo.value) return
  playEpisode(episode, {
    title: podcastInfo.value.title,
    artwork: podcastInfo.value.artwork,
    id: podcastInfo.value.id,
  })
}

const toggleEpisodes = () => {
  showEpisodes.value = !showEpisodes.value
}
</script>

<template>
  <Teleport to="body">
    <div v-if="currentEpisode" data-testid="podcast-mini-player"
      class="fixed bottom-4 right-4 z-50 w-80 rounded-xl border bg-black/80 border-orange-500/30 shadow-2xl shadow-black/50 p-4 space-y-3">
      <div class="flex items-center gap-3">
        <img v-if="podcastInfo?.artwork" :src="podcastInfo.artwork" :alt="podcastInfo.title"
          class="w-10 h-10 rounded object-cover shrink-0" loading="lazy">
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-white truncate">{{ currentEpisode.title }}</p>
          <p class="text-xs text-gray-500 truncate">{{ podcastInfo?.title }}</p>
        </div>
        <UButton
          :icon="isLoading ? 'i-lucide-loader' : (isPlaying ? 'i-lucide-pause' : 'i-lucide-play')"
          color="primary"
          size="sm"
          class="rounded-full shrink-0"
          :disabled="isLoading || hasError"
          @click="handleTogglePlay"
        />
        <UButton icon="i-lucide-x" variant="ghost" size="sm" class="shrink-0" @click="handleClose" />
      </div>

      <div v-if="hasError" class="text-xs text-red-400 text-center py-1">
        {{ t('podcast.player.unavailable') }}
      </div>

      <div v-else>
        <div ref="containerRef" class="w-full border border-white/5 rounded-2xl p-1" :class="{ 'opacity-0': isLoading }" />
        <div v-if="isLoading" class="grid gap-2">
          <USkeleton class="h-4 w-[250px]" />
          <USkeleton class="h-4 w-[200px]" />
        </div>
        <div class="flex items-center justify-between text-xs font-mono text-gray-500 mt-1">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <UButton variant="ghost" size="xs" icon="i-lucide-rewind" @click="handleSkip(-10)" />
          <UButton variant="ghost" size="xs" icon="i-lucide-rotate-ccw" @click="handleSkip(10)" />
        </div>
        <div class="flex items-center gap-1">
          <UButton
            v-if="!isDownloaded"
            :icon="isDownloading ? 'i-lucide-loader-2' : 'i-lucide-download'"
            :disabled="isDownloading"
            variant="ghost"
            size="xs"
            @click="saveForOffline"
          />
          <UButton
            v-else
            icon="i-lucide-check"
            variant="ghost"
            size="xs"
            color="success"
            @click="removeOffline"
          />
          <USelect
            v-model="playbackRate"
            :items="[
              { value: 0.5, label: '0.5x' },
              { value: 1, label: '1.0x' },
              { value: 1.5, label: '1.5x' },
              { value: 2, label: '2.0x' },
            ]"
            value-key="value"
            label-key="label"
            size="xs"
            class="w-20"
            :ui="{ content: 'z-50' }"
            @update:model-value="(val: number) => handleSetRate(val)"
          />
        </div>
      </div>

      <div v-if="podcastEpisodes.length > 0">
        <button
          class="w-full text-left text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1 py-1"
          @click="toggleEpisodes"
        >
          <UIcon :name="showEpisodes ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'" class="w-3 h-3" />
          {{ showEpisodes ? t('podcast.player.hideEpisodes') : t('podcast.player.showEpisodes', { count: podcastEpisodes.length }) }}
        </button>

        <div v-if="showEpisodes" class="space-y-1 max-h-48 overflow-y-auto mt-1">
          <button
            v-for="ep in podcastEpisodes"
            :key="ep.id"
            class="w-full text-left p-2 rounded-lg transition-colors"
            :class="currentEpisode?.id === ep.id ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-gray-300'"
            @click="handleSwitchEpisode(ep)"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="currentEpisode?.id === ep.id && isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
                class="w-3 h-3 shrink-0"
              />
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium truncate">{{ ep.title }}</p>
                <p class="text-[10px] text-gray-500">{{ ep.duration }}</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
