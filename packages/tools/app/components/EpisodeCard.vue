<script lang="ts" setup>
/**
 *
 * EpisodeCard — displays a single podcast episode with play and download options
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
}

withDefaults(defineProps<Props>(), {
  isPlaying: false,
  isDownloaded: false,
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'download'): void
  (e: 'remove-download'): void
}>()

const truncatedDescription = computed(() => {
  if (!description) return ''
  return description.length > 120 ? description.slice(0, 120) + '...' : description
})
</script>

<template>
  <div
    class="group rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-orange-500/30 hover:bg-white/10"
    data-testid="episode-card"
  >
    <div class="flex items-start gap-4">
      <button class="shrink-0 mt-1 cursor-pointer" @click="emit('play')">
        <div class="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
          <UIcon :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" class="w-4 h-4 text-orange-400" />
        </div>
      </button>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-medium leading-snug line-clamp-2 cursor-pointer" @click="emit('play')">{{ title }}</h4>
        <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span v-if="date">{{ date }}</span>
          <span v-if="duration">{{ duration }}</span>
        </div>
        <p v-if="truncatedDescription" class="text-xs text-gray-600 mt-2 leading-relaxed">{{ truncatedDescription }}</p>
      </div>
      <div class="shrink-0">
        <UButton
          v-if="!isDownloaded"
          icon="i-lucide-download"
          variant="ghost"
          size="xs"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="emit('download')"
        />
        <UButton
          v-else
          icon="i-lucide-check-circle"
          variant="ghost"
          size="xs"
          color="success"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="emit('remove-download')"
        />
      </div>
    </div>
  </div>
</template>
