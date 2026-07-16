<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const { cropBoxAspectRatio, finalVideoAspectRatio, fitMode } = useVideoCropper()

const cropAspects = [
  { value: null, label: 'Free', data: 'free' },
  { value: 1, label: '1:1', data: '1' },
  { value: 1.777, label: '16:9', data: '1.777' },
  { value: 0.5625, label: '9:16', data: '0.5625' },
  { value: 1.333, label: '4:3', data: '1.333' },
]

const finalAspects = [
  { value: null, label: 'Source', data: 'source' },
  { value: 1, label: '1:1', data: '1' },
  { value: 1.777, label: '16:9', data: '1.777' },
  { value: 0.5625, label: '9:16', data: '0.5625' },
  { value: 1.333, label: '4:3', data: '1.333' },
]

const fitModes = [
  { value: 'cover' as const, label: t('aspect_ratio.cover') },
  { value: 'contain' as const, label: t('aspect_ratio.contain') },
  { value: 'fill' as const, label: t('aspect_ratio.fill') },
]

function isSelected(value: number | null, current: number | null): boolean {
  return value === null ? current === null : value === current
}
</script>

<template>
  <UCard :ui="{ body: 'p-4', root: 'w-full' }">
    <template #header>
      <h4 class="font-semibold text-xs text-muted uppercase tracking-wider">{{ t('aspect_ratio.title') }}</h4>
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <div class="flex justify-between text-xs">
          <span class="font-medium text-highlighted">{{ t('aspect_ratio.crop_overlay') }}</span>
          <span class="text-dimmed font-mono text-[10px]">{{ cropBoxAspectRatio ? cropBoxAspectRatio.toFixed(3) : t('aspect_ratio.free') }}</span>
        </div>
        <div class="grid grid-cols-5 gap-1 bg-default p-1 rounded-xl border border-default">
          <UButton
            v-for="asp in cropAspects"
            :key="asp.data"
            size="xs"
            :color="isSelected(asp.value, cropBoxAspectRatio) ? 'primary' : 'neutral'"
            :variant="isSelected(asp.value, cropBoxAspectRatio) ? 'solid' : 'ghost'"
            class="font-mono"
            @click="()=>{cropBoxAspectRatio = asp.value}"
          >
            {{ asp.label }}
          </UButton>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex justify-between text-xs">
          <span class="font-medium text-highlighted">{{ t('aspect_ratio.final_video') }}</span>
          <span class="text-primary font-mono text-[10px]">{{ finalVideoAspectRatio ? finalVideoAspectRatio.toFixed(3) : t('aspect_ratio.source') }}</span>
        </div>
        <div class="grid grid-cols-5 gap-bg-default p-1 rounded-xl border border-default">
          <UButton
            v-for="asp in finalAspects"
            :key="asp.data"
            size="xs"
            :color="isSelected(asp.value, finalVideoAspectRatio) ? 'primary' : 'neutral'"
            :variant="isSelected(asp.value, finalVideoAspectRatio) ? 'solid' : 'ghost'"
            class="font-mono"
            @click="finalVideoAspectRatio = asp.value"
          >
            {{ asp.label }}
          </UButton>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex justify-between text-xs">
          <span class="font-medium text-highlighted">{{ t('aspect_ratio.fit_mode') }}</span>
          <span class="text-dimmed font-mono text-[10px]">{{ fitMode }}</span>
        </div>
        <div class="grid grid-cols-3 gap-bg-default p-1 rounded-xl border border-default">
          <UButton
            v-for="mode in fitModes"
            :key="mode.value"
            size="xs"
            :color="fitMode === mode.value ? 'primary' : 'neutral'"
            :variant="fitMode === mode.value ? 'solid' : 'ghost'"
            class="font-mono"
            @click="fitMode = mode.value"
          >
            {{ mode.label }}
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
