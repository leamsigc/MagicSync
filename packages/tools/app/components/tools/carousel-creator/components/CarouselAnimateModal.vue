<i18n src="#site/app/pages/tools/carousel-creator/carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck } from '#layers/BaseUI/app/utils/composables/useCarouselDeck'
import { useCarouselVideoExport, MOTION_PRESETS, type SlideMotionKey } from '../../../../composables/tools/carousel-creator/useCarouselVideoExport'

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

interface AnimateMusicTrack {
  id: string
  file: File
  volume: number
  loop: boolean
}

const toast = useToast()
const musicTracks = ref<AnimateMusicTrack[]>([])
const musicInput = ref<HTMLInputElement | null>(null)

watch(open, (value) => {
  if (!value) {
    musicTracks.value = []
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

const isAudioFile = (file: File): boolean => file.type.startsWith('audio/')

const handleChooseMusicClick = (): void => {
  musicInput.value?.click()
}

const handleMusicFiles = (e: Event): void => {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  const audioFiles = files.filter(isAudioFile)
  appendTracks(audioFiles)
  if (files.length > 0 && audioFiles.length === 0) showUnsupportedFile()
}

const appendTracks = (files: File[]): void => {
  files.forEach(addTrack)
}

const addTrack = (file: File): void => {
  musicTracks.value.push({ id: crypto.randomUUID(), file, volume: 0.8, loop: true })
}

const showUnsupportedFile = (): void => {
  toast.add({ title: t('animate.unsupportedFile'), color: 'warning', icon: 'i-lucide-triangle-alert' })
}

const handleRemoveTrack = (id: string): void => {
  musicTracks.value = musicTracks.value.filter(track => track.id !== id)
}

const updateTrack = (id: string, patch: Partial<Pick<AnimateMusicTrack, 'volume' | 'loop'>>): void => {
  const track = musicTracks.value.find(entry => entry.id === id)
  if (track) Object.assign(track, patch)
}

const handleTrackVolume = (id: string, value: number | undefined): void => {
  updateTrack(id, { volume: value ?? 0.8 })
}

const handleTrackLoop = (id: string, value: boolean): void => {
  updateTrack(id, { loop: value })
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
    tracks: musicTracks.value.map(track => ({
      id: track.id,
      blob: track.file,
      name: track.file.name,
      volume: track.volume,
      loop: track.loop,
    })),
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

        <!-- Music tracks -->
        <div class="space-y-2 rounded-lg border border-default bg-muted p-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('animate.music') }}</p>
            <UButton size="xs" variant="soft" color="primary" icon="i-lucide-music-2"
              :label="t('animate.addTrack')" data-testid="btn-choose-music"
              @click="handleChooseMusicClick" />
          </div>
          <div
            v-for="(track, index) in musicTracks" :key="track.id"
            :data-testid="`animate-track-${index}`"
            class="space-y-2 rounded-lg border border-default bg-default p-2.5">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-music-2" class="size-4 shrink-0 text-primary" />
              <span class="min-w-0 flex-1 truncate text-xs font-medium">{{ track.file.name }}</span>
              <UButton
                size="xs" variant="ghost" color="error" icon="i-lucide-x"
                :aria-label="t('animate.removeTrack')" :data-testid="`animate-remove-${index}`"
                @click="handleRemoveTrack(track.id)" />
            </div>
            <UFormField :label="`${t('animate.volume')} (${Math.round(track.volume * 100)}%)`" size="xs">
              <USlider
                :model-value="track.volume" :min="0" :max="1" :step="0.05"
                :data-testid="`animate-volume-${index}`"
                @update:model-value="(value) => handleTrackVolume(track.id, value)" />
            </UFormField>
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted">{{ t('animate.loop') }}</span>
              <USwitch
                :model-value="track.loop" size="xs" :data-testid="`animate-loop-${index}`"
                @update:model-value="(value) => handleTrackLoop(track.id, value)" />
            </div>
          </div>
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
      <input
        ref="musicInput" type="file" accept="audio/*" multiple class="hidden" data-testid="animate-music-input"
        @change="handleMusicFiles" />
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