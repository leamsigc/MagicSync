<script lang="ts" setup>
interface Props {
  id: string
  title: string
  date: string
  duration: string
  description: string
  isPlaying?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isPlaying: false,
})

const emit = defineEmits<{
  (e: 'play'): void
}>()

const truncatedDescription = computed(() => {
  if (!props.description) return ''
  return props.description.length > 120 ? props.description.slice(0, 120) + '...' : props.description
})
</script>

<template>
  <div
    class="group cursor-pointer rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-orange-500/30 hover:bg-white/10"
    data-testid="episode-card"
    @click="emit('play')"
  >
    <div class="flex items-start gap-4">
      <div class="shrink-0 mt-1">
        <div class="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
          <UIcon :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'" class="w-4 h-4 text-orange-400" />
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-medium text-white leading-snug line-clamp-2">{{ title }}</h4>
        <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span v-if="date">{{ date }}</span>
          <span v-if="duration">{{ duration }}</span>
        </div>
        <p v-if="truncatedDescription" class="text-xs text-gray-600 mt-2 leading-relaxed">{{ truncatedDescription }}</p>
      </div>
    </div>
  </div>
</template>
