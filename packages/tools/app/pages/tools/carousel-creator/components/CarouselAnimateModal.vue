<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck } from '../composables/useCarouselDeck'
import { useCarouselVideoExport, MOTION_PRESETS, type SlideMotionKey } from '../composables/useCarouselVideoExport'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const { slides, frame, renderSlideToPng } = useCarouselDeck()
const {
  exporting,
  progress,
  statusText,
  resultUrl,
  error,
  exportCarouselVideo,
  cancel,
  downloadResult,
} = useCarouselVideoExport()

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const fps = ref(30)
const secondsPerSlide = ref(3)
const crossfade = ref(false)
const motions = ref<SlideMotionKey[]>([])
const musicFile = ref<File | null>(null)
const musicVolume = ref(0.8)
const musicInput = ref<HTMLInputElement | null>(null)

watch(open, (value) => {
  if (!value) {
    musicFile.value = null
  }
})

const fpsItems = [{ label: '30 fps', value: 30 }, { label: '60 fps', value: 60 }]
const secondsItems = [2, 3, 4, 5, 6, 7, 8].map(n => ({ label: `${n}s`, value: n }))

function motionFor(index: number): SlideMotionKey {
  return motions.value[index] ?? 'none'
}

function setMotion(index: number, value: SlideMotionKey): void {
  motions.value[index] = value
}

function onMusicChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  musicFile.value = file
  input.value = ''
}

function getStage(): HTMLElement {
  return document.getElementById('carousel-export-stage')!
}

async function handleRender(): Promise<void> {
  const stage = getStage()
  if (!stage) return
  const settings = {
    fps: fps.value,
    secondsPerSlide: secondsPerSlide.value,
    crossfade: crossfade.value,
    crossfadeSeconds: 0.5,
    motions: motions.value,
    music: musicFile.value ? { blob: musicFile.value, volume: musicVolume.value } : null,
    width: frame.value.w,
    height: frame.value.h,
  }
  await exportCarouselVideo(
    (index: number) => renderSlideToPng(stage, index),
    slides.value.length,
    settings,
  )
}
</script>

<template>
  <UModal v-model:open="open" :title="t('animate.title')" :description="t('animate.description')" class="max-w-2xl"
    :ui="{ overlay: 'bg-black/60' }"
    data-testid="animate-modal">
    <template #body>
      <div class="space-y-4">
        <!-- Settings -->
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('animate.fps')" size="xs">
            <USelect :model-value="fps" :items="fpsItems" value-key="value" size="sm" class="w-full"
              data-testid="animate-fps" @update:model-value="(v: number | null) => fps = v ?? 30" />
          </UFormField>
          <UFormField :label="t('animate.duration')" size="xs">
            <USelect :model-value="secondsPerSlide" :items="secondsItems" value-key="value" size="sm" class="w-full"
              data-testid="animate-duration"
              @update:model-value="(v: number | null) => secondsPerSlide = v ?? 3" />
          </UFormField>
        </div>

        <!-- Music -->
        <div class="space-y-2 rounded-lg border border-default bg-muted p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('animate.music') }}</p>
            <UButton size="xs" variant="soft" color="primary" icon="i-lucide-music-2"
              :label="musicFile ? musicFile.name : t('animate.chooseMusic')" data-testid="btn-choose-music"
              @click="musicInput?.click()" />
          </div>
          <template v-if="musicFile">
            <UFormField :label="`${t('animate.volume')} (${Math.round(musicVolume * 100)}%)`" size="xs">
              <USlider :model-value="musicVolume" :min="0" :max="1" :step="0.05" data-testid="animate-volume"
                @update:model-value="(v: number | undefined) => musicVolume = v ?? 0.8" />
            </UFormField>
          </template>
          <p class="text-[10px] text-muted">{{ t('animate.musicHint') }}</p>
        </div>

        <USwitch v-model="crossfade" :label="t('animate.crossfade')" data-testid="animate-crossfade" />

        <!-- Per-slide motion -->
        <div class="space-y-1.5">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('animate.motions') }}</p>
          <div v-for="(slide, index) in slides" :key="slide.id" class="flex items-center gap-2">
            <span class="w-8 shrink-0 text-[10px] font-mono text-muted">{{ String(index + 1).padStart(2, '0') }}</span>
            <USelect :model-value="motionFor(index)" :items="MOTION_PRESETS" value-key="key" size="xs" class="flex-1"
              :data-testid="`animate-motion-${index}`"
              @update:model-value="(v: SlideMotionKey | null) => setMotion(index, v ?? 'none')" />
          </div>
        </div>

        <USeparator />

        <!-- Progress -->
        <div v-if="exporting" class="space-y-2">
          <div class="flex items-center justify-between text-[11px] text-muted">
            <span data-testid="animate-status">{{ statusText }}</span>
            <span class="font-mono">{{ Math.round(progress * 100) }}%</span>
          </div>
          <UProgress :model-value="Math.round(progress * 100)" :max="100" size="sm" data-testid="animate-progress" />
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" :label="t('animate.cancel')"
            data-testid="btn-animate-cancel" @click="cancel" />
        </div>

        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="error"
          data-testid="animate-error" />

        <!-- Result -->
        <div v-if="resultUrl && !exporting" class="space-y-3">
          <video :src="resultUrl" controls class="mx-auto max-h-80 rounded-lg border border-default bg-black"
            data-testid="animate-preview" />
          <UButton block color="primary" icon="i-lucide-download" :label="t('animate.download')"
            data-testid="btn-animate-download" @click="downloadResult()" />
        </div>
      </div>
      <input ref="musicInput" type="file" accept="audio/*" class="hidden" data-testid="animate-music-input"
        @change="onMusicChange" />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" :disabled="exporting"
          @click="open = false" />
        <UButton color="primary" icon="i-lucide-clapperboard" :label="t('animate.render')" :loading="exporting"
          :disabled="!slides.length" data-testid="btn-animate-render" @click="handleRender" />
      </div>
    </template>
  </UModal>
</template>