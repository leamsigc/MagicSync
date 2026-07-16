<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const {
  layers, activeLayerId, currentTime, duration, activeLayer,
  setCurrentTime, addOrUpdateKeyframeAtCurrentTime, removeKeyframeAtCurrentTime,
  clearActiveLayerTrajectory, formatTime,
} = useVideoCropper()

const trackContainer = ref<HTMLDivElement>()

function handleKeyframeDrag(kf: { id: string; time: number }, e: PointerEvent) {
  if (kf.id === 'kf-initial') return
  const track = trackContainer.value
  if (!track) return

  function onMove(ev: PointerEvent) {
    const rect = track.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
    const newTime = parseFloat((pct * duration.value).toFixed(2))
    kf.time = newTime
    const layer = activeLayer.value
    if (layer) layer.keyframes.sort((a, b) => a.time - b.time)
    setCurrentTime(newTime)
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  e.preventDefault()
}
</script>

<template>
  <UCard :ui="{ body: 'p-4', root: 'w-full' }">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-list-video" class="w-4 h-4 text-primary" />
          <span class="font-semibold text-sm text-highlighted">{{ t('editor.drop_keyframe') }}</span>
        </div>
        <div class="flex gap-1">
          <UButton
            color="primary"
            variant="soft"
            size="xs"
            icon="i-lucide-plus"
            @click="addOrUpdateKeyframeAtCurrentTime"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-minus"
            :disabled="!activeLayer || activeLayer.keyframes.length <= 1"
            @click="removeKeyframeAtCurrentTime"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-rotate-ccw"
            :disabled="!activeLayer || activeLayer.keyframes.length <= 1"
            @click="clearActiveLayerTrajectory"
          />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <div v-if="!activeLayer || !activeLayer.keyframes.length" class="text-xs text-dimmed text-center py-4 font-mono">
        {{ t('editor.motion_tracking_hint') }}
      </div>

      <div
        ref="trackContainer"
        class="relative w-full h-8 bg-default rounded-lg border border-default overflow-hidden"
      >
        <div v-for="layer in layers" :key="layer.id" class="absolute inset-0">
          <div
            v-for="kf in layer.keyframes"
            :key="kf.id"
            class="absolute top-1/2 -translate-y-1/2 w-3 h-3 -ml-1.5 rounded-full border-2 border-(--ui-bg) cursor-pointer hover:scale-125 transition-transform z-20 touch-none"
            :class="layer.id === activeLayerId ? 'bg-primary border-(--ui-primary)' : 'bg-(--ui-text-dimmed) border-(--ui-text-dimmed)'"
            :style="{ left: `${duration > 0 ? (kf.time / duration) * 100 : 0}%` }"
            :title="`${kf.time.toFixed(1)}s (${layer.name})`"
            @pointerdown="e => handleKeyframeDrag(kf, e)"
          />
        </div>

        <div
          class="absolute top-0 w-0.5 h-full bg-primary pointer-events-none z-10 transition-all duration-75"
          :style="{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }"
        />
      </div>

      <div class="flex justify-between text-[10px] font-mono text-dimmed">
        <span>00:00.0</span>
        <span>{{ formatTime(duration) }}</span>
      </div>
    </div>
  </UCard>
</template>
