<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const {
  videoMetadata, layers, activeLayerId, currentTime, isPlaying, volume,
  cropBoxAspectRatio, interpolation, duration,
  interpolateCropBox, formatTime,
  togglePlay, seekFrames, setCurrentTime, updateVolume, toggleMute, extractThumbnail,
  handleBoxDragStart, handleResizeStart, handleDragMove, handleDragEnd,
  onVideoMetadataLoaded,
  getVideo,
} = useVideoCropper()

const stageContainer = ref<HTMLDivElement>()
const overlayRef = ref<HTMLDivElement>()
const cropBoxRef = ref<HTMLDivElement>()
const inactiveCanvasRef = ref<HTMLCanvasElement>()
const videoRef = ref<HTMLVideoElement>()
const scrubberRef = ref<HTMLInputElement>()

const activeLayer = computed(() => layers.value.find(l => l.id === activeLayerId.value))

const currentCrop = computed(() => {
  const layer = activeLayer.value
  if (!layer) return { x: 0.35, y: 0.15, width: 0.3, height: 0.7 }
  return interpolateCropBox(currentTime.value, layer.keyframes, interpolation.value)
})

const cropX = computed(() => currentCrop.value.x)
const cropY = computed(() => currentCrop.value.y)
const cropW = computed(() => currentCrop.value.width)
const cropH = computed(() => currentCrop.value.height)

function updateStageOverlayLayout() {
  if (!videoMetadata.value || !overlayRef.value || !stageContainer.value) return
  const container = stageContainer.value
  const videoRatio = videoMetadata.value.width / videoMetadata.value.height
  const cw = container.clientWidth
  const ch = container.clientHeight
  const containerRatio = cw / ch
  let w = cw, h = ch, left = 0, top = 0
  if (containerRatio > videoRatio) {
    h = ch; w = h * videoRatio; left = (cw - w) / 2
  } else {
    w = cw; h = w / videoRatio; top = (ch - h) / 2
  }
  overlayRef.value!.style.width = `${w}px`
  overlayRef.value!.style.height = `${h}px`
  overlayRef.value!.style.left = `${left}px`
  overlayRef.value!.style.top = `${top}px`
  const ic = inactiveCanvasRef.value
  if (ic) { ic.width = w; ic.height = h }
}

function updateCropBoxFromTime() {
  const layer = activeLayer.value
  if (!layer || !overlayRef.value) return
  const crop = currentCrop.value
  const ow = overlayRef.value.clientWidth
  const oh = overlayRef.value.clientHeight
  const box = cropBoxRef.value
  if (box) {
    box.style.width = `${crop.width * ow}px`
    box.style.height = `${crop.height * oh}px`
    box.style.left = `${crop.x * ow}px`
    box.style.top = `${crop.y * oh}px`
    box.style.display = 'block'
  }
  drawInactiveLayers()
}

function drawInactiveLayers() {
  const ic = inactiveCanvasRef.value
  if (!ic || !videoMetadata.value) return
  const ctx = ic.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, ic.width, ic.height)
  const time = currentTime.value
  layers.value.forEach((layer) => {
    if (layer.id === activeLayerId.value) return
    if (!layer.keyframes.length) return
    const crop = interpolateCropBox(time, layer.keyframes, interpolation.value)
    const x = crop.x * ic.width; const y = crop.y * ic.height
    const w = crop.width * ic.width; const h = crop.height * ic.height
    ctx.strokeStyle = layer.color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4])
    ctx.strokeRect(x, y, w, h); ctx.setLineDash([])
    ctx.fillStyle = layer.color + '33'
    const text = layer.name.toUpperCase(); ctx.font = 'bold 8px monospace'
    const tw = ctx.measureText(text).width
    ctx.fillRect(x + 5, y + 5, tw + 10, 16)
    ctx.fillStyle = layer.color; ctx.fillText(text, x + 10, y + 16)
  })
}

function syncCropBox() {
  updateStageOverlayLayout()
  updateCropBoxFromTime()
}

function handlePointerDown(e: PointerEvent, type: 'drag' | 'resize', handle?: string) {
  if (type === 'resize' && handle) handleResizeStart(e, handle)
  else handleBoxDragStart(e)
  const el = cropBoxRef.value
  if (el) el.setPointerCapture(e.pointerId)
}

function handlePointerMove(e: PointerEvent) {
  const ow = overlayRef.value?.clientWidth || 1
  const oh = overlayRef.value?.clientHeight || 1
  const result = handleDragMove(e, ow, oh)
  if (result && cropBoxRef.value) {
    cropBoxRef.value.style.left = `${result.x * ow}px`
    cropBoxRef.value.style.top = `${result.y * oh}px`
    cropBoxRef.value.style.width = `${result.w * ow}px`
    cropBoxRef.value.style.height = `${result.h * oh}px`
  }
}

function handlePointerUp(e: PointerEvent) {
  handleDragEnd()
  const el = cropBoxRef.value
  if (el) el.releasePointerCapture(e.pointerId)
}

function handleScrubInput(e: Event) {
  setCurrentTime(parseFloat((e.target as HTMLInputElement).value))
}

defineExpose({ videoElement: videoRef })

watch(() => currentTime.value, updateCropBoxFromTime)
watch(() => activeLayerId.value, updateCropBoxFromTime)
watch(() => layers.value.length, updateCropBoxFromTime)
watch(() => cropBoxAspectRatio.value, updateCropBoxFromTime)

onMounted(() => {
  syncCropBox()
  if (videoRef.value) videoRef.value.crossOrigin = 'anonymous'
  const el = videoRef.value
  if (!el) return
  el.addEventListener('timeupdate', () => { currentTime.value = el.currentTime })
  el.addEventListener('play', () => { isPlaying.value = true })
  el.addEventListener('pause', () => { isPlaying.value = false })
  el.addEventListener('loadedmetadata', () => {
    duration.value = el.duration
    onVideoMetadataLoaded()
    syncCropBox()
  })
})

useEventListener(window, 'resize', syncCropBox)
</script>

<template>
  <UCard :ui="{ body: 'p-4', root: 'w-full' }">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-crop" class="w-4 h-4 text-primary" />
          <span class="font-semibold text-sm text-highlighted">Source Stage (Motion Editor)</span>
        </div>
        <div class="text-xs text-dimmed font-mono">
          <template v-if="videoMetadata">
            {{ videoMetadata.width }}x{{ videoMetadata.height }} &bull; {{ videoMetadata.duration.toFixed(1) }}s
          </template>
        </div>
      </div>
    </template>

    <div
      ref="stageContainer"
      class="relative w-full aspect-video bg-black rounded-xl overflow-hidden"
    >
      <video
        ref="videoRef"
        :src="videoMetadata?.url"
        aria-label="source-video"
        class="absolute inset-0 w-full h-full object-contain"
        crossorigin="anonymous"
      ></video>

      <div ref="overlayRef" class="absolute pointer-events-none">
        <canvas ref="inactiveCanvasRef" class="absolute inset-0 pointer-events-none z-10"></canvas>

        <svg class="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 1 1" preserveAspectRatio="none">
          <defs>
            <mask id="crop-mask">
              <rect width="1" height="1" fill="white" />
              <rect :x="cropX" :y="cropY" :width="cropW" :height="cropH" fill="black" />
            </mask>
          </defs>
          <rect width="1" height="1" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
        </svg>

        <div
          ref="cropBoxRef"
          class="absolute border-2 cursor-move z-30 hidden pointer-events-auto"
          style="border-color: var(--ui-primary)"
          @pointerdown="e => handlePointerDown(e, 'drag')"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
        >
          <div class="absolute -top-1 -left-1 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-nw-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 'nw')"></div>
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-n-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 'n')"></div>
          <div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-ne-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 'ne')"></div>
          <div class="absolute top-1/2 -translate-y-1/2 -left-1 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-w-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 'w')"></div>
          <div class="absolute top-1/2 -translate-y-1/2 -right-1 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-e-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 'e')"></div>
          <div class="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-sw-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 'sw')"></div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-s-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 's')"></div>
          <div class="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-primary rounded-sm border border-bg cursor-se-resize z-40 pointer-events-auto" @pointerdown.stop="e => handlePointerDown(e, 'resize', 'se')"></div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3 mt-4">
      <div class="flex items-center gap-3">
        <span class="text-xs font-mono text-dimmed w-12 text-right">{{ formatTime(currentTime) }}</span>
        <div class="flex-1 relative h-6 flex items-center">
          <div class="absolute inset-x-0 h-1.5 bg-muted rounded-full overflow-hidden">
            <div class="h-full bg-primary transition-all" :style="{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }"></div>
          </div>
          <input
            ref="scrubberRef"
            type="range"
            :min="0"
            :max="duration"
            step="0.1"
            :value="currentTime"
            class="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
            @input="handleScrubInput"
          >
        </div>
        <span class="text-xs font-mono text-dimmed w-12">{{ formatTime(duration) }}</span>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UButton
            :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="togglePlay"
          />
          <UButton icon="i-lucide-skip-back" color="neutral" variant="ghost" size="sm" @click="seekFrames(-1)" />
          <UButton icon="i-lucide-skip-forward" color="neutral" variant="ghost" size="sm" @click="seekFrames(1)" />
          <div class="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-xl">
            <UButton
              :icon="volume === 0 ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="toggleMute"
            />
            <input
              type="range"
              :min="0"
              :max="1"
              :step="0.05"
              :value="volume"
              class="w-16 h-1 accent-primary cursor-pointer"
              @input="updateVolume(parseFloat(($event.target as HTMLInputElement).value))"
            >
          </div>
        </div>
        <UButton color="primary" variant="soft" size="xs" icon="i-lucide-image" @click="extractThumbnail">
          Extract Frame Thumbnail
        </UButton>
      </div>
    </div>

    <p class="text-[10px] text-dimmed font-mono text-center mt-3">{{ t('editor.motion_tracking_hint') }}</p>
  </UCard>
</template>
