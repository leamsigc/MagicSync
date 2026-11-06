<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { objectAnimation } from '../../../../shared/image-editor/studio-canvas'

/**
 * Bottom timeline — the Polotno-style strip: enable "edit as video", scrub the
 * page duration, play/pause the animation preview and see which layers move.
 */
const { t } = useI18n()
const { editor, timelineOpen } = useFabricJs()

const playing = ref(false)
const elapsed = ref(0)
const duration = ref(4000)
let raf: number | null = null
let startedAt = 0

const animatedLayers = computed(() => {
  const objects = editor.value?.fabricCanvas?.getObjects() ?? []
  return objects.filter(object => {
    if ((object as { id?: string }).id === 'workspace') return false
    const animation = objectAnimation(object)
    return Boolean(animation.enter && animation.enter.type !== 'none') || Boolean(animation.loop && animation.loop.type !== 'none')
  })
})

const progress = computed(() => Math.min(100, Math.round((elapsed.value / duration.value) * 100)))
const elapsedLabel = computed(() => `${(elapsed.value / 1000).toFixed(1)}s / ${(duration.value / 1000).toFixed(1)}s`)

function syncDuration(): void {
  const plugin = editor.value?.getPlugin?.('studio') as { getPageDuration?: () => number } | undefined
  duration.value = plugin?.getPageDuration?.() ?? 4000
}

function tick(now: number): void {
  elapsed.value = now - startedAt
  if (elapsed.value >= duration.value) {
    stop()
    return
  }
  raf = requestAnimationFrame(tick)
}

async function play(): Promise<void> {
  syncDuration()
  const plugin = editor.value?.getPlugin?.('animation') as { playPreview?: (ms: number) => Promise<void>; stopPreview?: () => void } | undefined
  if (!plugin?.playPreview) return
  stop()
  playing.value = true
  elapsed.value = 0
  startedAt = performance.now()
  raf = requestAnimationFrame(tick)
  try {
    await plugin.playPreview(duration.value)
  } finally {
    if (playing.value) playing.value = false
  }
}

function stop(): void {
  if (raf !== null) cancelAnimationFrame(raf)
  raf = null
  if (playing.value) {
    const plugin = editor.value?.getPlugin?.('animation') as { stopPreview?: () => void } | undefined
    plugin?.stopPreview?.()
  }
  playing.value = false
}

function seek(event: MouseEvent): void {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  elapsed.value = ratio * duration.value
}

function close(): void {
  stop()
  timelineOpen.value = false
}

onMounted(syncDuration)
onUnmounted(stop)
</script>

<template>
  <div
    v-if="timelineOpen"
    class="absolute inset-x-0 bottom-0 z-30 border-t border-default bg-elevated/95 backdrop-blur-md">
    <div class="flex items-center gap-3 px-3 py-1.5">
      <div class="flex items-center gap-2">
        <USwitch :model-value="timelineOpen" size="xs" @update:model-value="close" />
        <span class="text-[11px] font-medium">{{ t('studio.timeline.editAsVideo') }}</span>
      </div>

      <div class="ml-2 flex items-center gap-1">
        <UButton
          size="xs" color="neutral" variant="soft"
          :icon="playing ? 'lucide:pause' : 'lucide:play'"
          :aria-label="t('studio.timeline.preview')"
          @click="playing ? stop() : play()" />
        <span class="font-mono text-[11px] text-muted tabular-nums">{{ elapsedLabel }}</span>
      </div>

      <div class="ml-auto flex items-center gap-3 text-[11px] text-muted">
        <span>{{ t('studio.timeline.animatedCount', { count: animatedLayers.length }) }}</span>
        <UButton size="xs" variant="ghost" color="neutral" icon="lucide:x" :aria-label="t('common.close')" @click="close" />
      </div>
    </div>

    <div class="px-3 pb-2">
      <div
        class="relative h-10 cursor-pointer overflow-hidden rounded-lg border border-default bg-default"
        @click="seek">
        <div class="absolute inset-y-0 left-0 bg-primary/10" :style="{ width: `${progress}%` }" />
        <div class="absolute inset-y-1.5 left-1 flex items-center gap-1">
          <span class="rounded-md border border-primary/40 bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary">
            {{ t('studio.timeline.page') }} 1 · {{ (duration / 1000).toFixed(1) }}s
          </span>
        </div>
        <div class="absolute inset-y-0 w-px bg-primary" :style="{ left: `${progress}%` }" />
        <div class="absolute inset-x-0 bottom-0 flex justify-between px-1 pb-0.5 text-[9px] font-mono text-dimmed">
          <span>0s</span>
          <span>{{ (duration / 2000).toFixed(1) }}s</span>
          <span>{{ (duration / 1000).toFixed(1) }}s</span>
        </div>
      </div>
    </div>
  </div>
</template>
