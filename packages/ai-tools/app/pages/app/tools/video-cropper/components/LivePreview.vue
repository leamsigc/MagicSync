<i18n src="../index.json"></i18n>

<script lang="ts" setup>
import { useVideoCropper } from '../composables/useVideoCropper'

const { t } = useI18n()

const {
  videoMetadata, layers, currentTime, finalVideoAspectRatio, fitMode,
  subtitleStyle, subtitleText, settings,
  interpolateCropBox, getVideo,
} = useVideoCropper()

const canvasRef = ref<HTMLCanvasElement>()
const previewContainer = ref<HTMLDivElement>()
const aspectBadge = ref('Source Ratio')

function updateCanvasSize() {
  if (!videoMetadata.value || !canvasRef.value || !previewContainer.value) return
  const parent = previewContainer.value
  const finalAspect = finalVideoAspectRatio.value
  let width = parent.clientWidth - 16
  let height = width / (16 / 9)
  if (finalAspect === null) {
    height = width / videoMetadata.value.aspectRatio
  } else {
    height = width / finalAspect
  }
  const canvas = canvasRef.value
  canvas.width = width
  canvas.height = height
}

function drawPreview() {
  const canvas = canvasRef.value
  if (!canvas || !videoMetadata.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const exportW = canvas.width
  const exportH = canvas.height
  ctx.fillStyle = '#0a0a0b'
  ctx.fillRect(0, 0, exportW, exportH)
  const N = layers.value.length
  const stacking = settings.value.stackingDirection
  layers.value.forEach((layer, index) => {
    const crop = interpolateCropBox(currentTime.value, layer.keyframes, settings.value.interpolation)
    const sx = crop.x * videoMetadata.value!.width
    const sy = crop.y * videoMetadata.value!.height
    const sW = crop.width * videoMetadata.value!.width
    const sH = crop.height * videoMetadata.value!.height
    if (sW <= 0 || sH <= 0) return
    let dx = 0, dy = 0, dW = exportW, dH = exportH
    if (stacking === 'vertical') { dH = exportH / N; dy = index * dH }
    else { dW = exportW / N; dx = index * dW }
    let fSx = sx, fSy = sy, fSW = sW, fSH = sH
    let dX = dx, dY = dy, dW2 = dW, dH2 = dH
    if (fitMode.value === 'cover') {
      const srcA = sW / sH; const dstA = dW / dH
      if (srcA > dstA) { fSW = sH * dstA; fSx = sx + (sW - fSW) / 2 }
      else if (srcA < dstA) { fSH = sW / dstA; fSy = sy + (sH - fSH) / 2 }
    } else if (fitMode.value === 'contain') {
      const srcA = sW / sH; const dstA = dW / dH
      if (srcA > dstA) { const aH = dW / srcA; dY += (dH - aH) / 2; dH2 = aH }
      else { const aW = dH * srcA; dX += (dW - aW) / 2; dW2 = aW }
    }
    const el = getVideo()
    if (el && el.readyState >= 2) {
      ctx.drawImage(el, fSx, fSy, fSW, fSH, dX, dY, dW2, dH2)
    }
    if (index > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 2.5; ctx.beginPath()
      if (stacking === 'vertical') { ctx.moveTo(0, dy); ctx.lineTo(exportW, dy) }
      else { ctx.moveTo(dx, 0); ctx.lineTo(dx, exportH) }
      ctx.stroke()
    }
    ctx.fillStyle = layer.color
    const text = layer.name.toUpperCase()
    ctx.font = 'bold 10px monospace'
    const tw = ctx.measureText(text).width
    ctx.fillRect(dX + 10, dy + 10, tw + 12, 18)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, dX + 16, dy + 22)
  })
}

useRafFn(() => {
  const canvas = canvasRef.value
  if (!canvas || !previewContainer.value) return
  if (canvas.width !== previewContainer.value.clientWidth - 16) updateCanvasSize()
  drawPreview()
})

useResizeObserver(previewContainer, updateCanvasSize)

watch(() => finalVideoAspectRatio.value, () => {
  aspectBadge.value = finalVideoAspectRatio.value ? `${finalVideoAspectRatio.value.toFixed(3)}` : 'Source Ratio'
  updateCanvasSize()
})

onMounted(updateCanvasSize)
</script>

<template>
  <UCard :ui="{ body: 'p-4', root: 'w-full' }">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
          <span class="font-semibold text-sm text-highlighted">{{ t('preview.title') }}</span>
        </div>
        <UBadge color="neutral" variant="subtle" size="sm">
          {{ aspectBadge }}
        </UBadge>
      </div>
    </template>

    <div ref="previewContainer" class="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center p-2">
      <canvas ref="canvasRef" class="max-w-full max-h-full block object-contain shadow-2xl border border-default rounded bg-black"></canvas>
    </div>

    <p class="text-[10px] text-dimmed font-mono text-center mt-3">*{{ t('preview.live_hint') }}*</p>
  </UCard>
</template>
