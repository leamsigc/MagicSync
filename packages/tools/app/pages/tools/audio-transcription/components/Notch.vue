<i18n src="../index.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Notch component - floating processing indicator
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

interface Props {
  status: string
  progress: number
  isExpanded: boolean
  activeProject: Project | null
}

const props = defineProps<Props>()

defineEmits<{
  (e: 'toggle'): void
  (e: 'stop'): void
}>()

const { t } = useI18n()

const progressOffset = computed(() => {
  return 14 * 2 * Math.PI * (1 - (props.progress || 0) / 100)
})
</script>

<template>
  <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
    <div :class="[
      ' border border-white/10 shadow-2xl  overflow-hidden backdrop-blur-xl',
      isExpanded ? 'p-6 rounded-xl' : 'p-2 px-4 rounded-3xl'
    ]">
      <div class="flex items-center justify-between cursor-pointer" @click="$emit('toggle')">
        <div class="flex items-center gap-3">
          <div class="relative flex items-center justify-center w-8 h-8">
            <svg class="w-full h-full transform -rotate-90">
              <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="transparent"
                class="text-white/10" />
              <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="transparent"
                :stroke-dasharray="14 * 2 * Math.PI" :stroke-dashoffset="progressOffset"
                class="text-emerald-500 transition-all duration-300" />
            </svg>
            <UIcon name="i-lucide-loader-2" class="w-3 h-3 text-emerald-500 absolute animate-spin" />
          </div>
          <div>
            <p class="text-xs font-bold text-emerald-500 uppercase tracking-wider">{{ status || 'Processing...' }}</p>
            <p v-if="!isExpanded && activeProject" class="text-sm text-white font-medium truncate max-w-[200px]">
              {{ activeProject.filename }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="!isExpanded" class="text-sm font-mono text-gray-400">{{ Math.round(progress || 0) }}%</span>
          <UIcon :name="isExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-4 h-4 text-gray-500" />
        </div>
      </div>

      <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 h-0"
        enter-to-class="opacity-100 h-auto" leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 h-auto" leave-to-class="opacity-0 h-0">
        <div v-if="isExpanded && activeProject" class="mt-6 space-y-4">
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">{{ t('audio-transcription.projectDetail.file') }}</span>
              <span class="text-white font-medium truncate max-w-[200px]">{{ activeProject.filename }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">{{ t('audio-transcription.projectDetail.engine') }}</span>
              <span class="text-white font-medium">{{ activeProject.engine.split('/').pop() }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">{{ t('audio-transcription.projectDetail.progress') }}</span>
              <span class="text-emerald-500 font-mono">{{ Math.round(progress || 0) }}%</span>
            </div>
          </div>

          <UProgress :model-value="progress" color="success" size="xs" />

          <UButton color="error" variant="soft" icon="i-lucide-square" :label="t('audio-transcription.stop')"
            @click.stop="$emit('stop')" />
        </div>
      </Transition>
    </div>
  </div>
</template>
