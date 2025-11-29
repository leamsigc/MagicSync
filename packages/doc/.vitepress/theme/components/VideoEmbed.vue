<template>
  <div class="my-8 rounded-lg overflow-hidden bg-[var(--vp-c-bg-soft)] border border-[var(--vp-c-divider)]">
    <div class="px-5 py-4 border-b border-[var(--vp-c-divider)]" v-if="title">
      <h3 class="m-0 mb-2 text-lg font-semibold text-[var(--vp-c-text-1)]">{{ title }}</h3>
      <p v-if="description" class="m-0 text-sm text-[var(--vp-c-text-2)]">{{ description }}</p>
    </div>
    <div class="p-5">
      <div class="relative pb-[56.25%] h-0 overflow-hidden rounded-lg bg-[var(--vp-c-bg)]">
        <iframe
          v-if="provider === 'youtube'"
          :src="`https://www.youtube.com/embed/${videoId}`"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          class="absolute top-0 left-0 w-full h-full rounded-lg"
        ></iframe>
        <iframe
          v-else-if="provider === 'twitter'"
          :src="`https://platform.twitter.com/embed/Tweet.html?id=${videoId}`"
          frameborder="0"
          allowfullscreen
          class="absolute top-0 left-0 w-full h-full rounded-lg"
        ></iframe>
        <div v-else class="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--vp-c-brand-soft)] to-[var(--vp-c-purple-soft)] text-[var(--vp-c-text-1)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-4 text-[var(--vp-c-brand-1)]">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <p class="m-0 mb-4 text-base font-medium">Video: {{ title || 'Video Tutorial' }}</p>
          <a v-if="url" :href="url" target="_blank" class="inline-block px-4 py-2 bg-[var(--vp-c-brand-1)] text-white no-underline rounded font-medium transition-colors duration-300 hover:bg-[var(--vp-c-brand-2)]">Watch Video</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title?: string
  description?: string
  url?: string
  provider?: 'youtube' | 'twitter' | 'custom'
}>()

const videoId = computed(() => {
  if (!props.url) return ''

  if (props.provider === 'youtube') {
    const match = props.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
    return match ? match[1] : ''
  }

  if (props.provider === 'twitter') {
    const match = props.url.match(/status\/(\d+)/)
    return match ? match[1] : ''
  }

  return ''
})
</script>

<style scoped>
/* Tailwind classes used in template */
</style>
