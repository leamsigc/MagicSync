<script lang="ts" setup>
/**
 *
 * PodcastCard — displays a search result podcast card
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

interface Props {
  id: number
  title: string
  author: string
  artwork: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', id: number): void
  (e: 'favorite', podcast: { id: number; title: string; author: string; artwork: string; feedUrl: string }): void
}>()
</script>

<template>
  <div
    class="group cursor-pointer rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-orange-500/30 hover:bg-white/10"
    data-testid="podcast-card"
    @click="emit('select', props.id)"
  >
    <div class="flex gap-4">
      <img
        v-if="artwork"
        :src="artwork"
        :alt="title"
        class="w-20 h-20 rounded-lg object-cover shrink-0"
        loading="lazy"
      >
      <div v-else class="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
        <UIcon name="i-lucide-microphone" class="w-8 h-8 text-gray-600" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-white line-clamp-2 leading-snug">{{ title }}</h3>
        <p class="text-xs text-gray-500 mt-1 truncate">{{ author }}</p>
      </div>
    </div>
  </div>
</template>
