<script lang="ts" setup>
/**
 *
 * EpisodeCard — displays a single podcast episode with play, download, and played indicators
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

interface Props {
  id: string
  title: string
  date: string
  duration: string
  description: string
  isPlaying?: boolean
  isDownloaded?: boolean
  isPlayed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
  isDownloaded: false,
  isPlayed: false,
  description: ''
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'download'): void
  (e: 'remove-download'): void
}>()

const truncatedDescription = computed(() => {
  if (!props.description) return ''
  return props.description.length > 120 ? props.description.slice(0, 120) + '...' : props.description
})
</script>

<template>
  <div
    class="group rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-orange-500/30 hover:bg-white/10"
    :class="{ 'opacity-60': isPlayed && !isPlaying }" data-testid="episode-card">
    <div class="flex items-start gap-4">
      <button class="shrink-0 mt-1 cursor-pointer" @click="emit('play')">
        <div class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          :class="isPlaying ? 'bg-orange-500' : 'bg-orange-500/20 group-hover:bg-orange-500/30'">
          <UIcon :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" class="w-4 h-4"
            :class="isPlaying ? 'text-white' : 'text-orange-400'" />
        </div>
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-medium leading-snug line-clamp-2 cursor-pointer flex-1"
            :class="isPlayed && !isPlaying ? 'text-gray-500' : ''" @click="emit('play')">
            {{ title }}
          </h4>
          <div class="flex items-center gap-1 shrink-0">
            <UIcon v-if="isDownloaded" name="i-lucide-hard-drive" class="w-3.5 h-3.5 text-emerald-400"
              title="Downloaded for offline" />
            <UIcon v-if="isPlayed && !isPlaying" name="i-lucide-check-circle" class="w-3.5 h-3.5 text-gray-500"
              title="Already played" />
          </div>
        </div>
        <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span v-if="date">{{ date }}</span>
          <span v-if="duration">{{ duration }}</span>
        </div>
        <p v-if="truncatedDescription" class="text-xs text-gray-600 mt-2 leading-relaxed">{{ truncatedDescription }}</p>
      </div>
      <div class="shrink-0">
        <UButton v-if="!isDownloaded" icon="i-lucide-download" variant="ghost" size="xs"
          class="opacity-0 group-hover:opacity-100 transition-opacity" title="Download for offline"
          @click.stop="emit('download')" />
        <UButton v-else icon="i-lucide-trash-2" variant="ghost" size="xs"
          class="opacity-0 group-hover:opacity-100 transition-opacity" color="error" title="Remove download"
          @click.stop="emit('remove-download')" />
      </div>
    </div>
  </div>
</template>
