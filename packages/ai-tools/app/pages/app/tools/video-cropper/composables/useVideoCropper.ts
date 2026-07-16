import type {
  CropLayer,
  ExportSettings,
  VideoMetadata,
  InterpolationMode,
  StackingDirection,
  CustomAudioTrack,
  SubtitleStyle,
  ExportProgress,
} from '../components/types'
import { LAYER_COLORS } from '../components/types'

// ── Module-level singleton state ──────────────────────────────────

const videoFile = ref<File | null>(null)
const videoMetadata = ref<VideoMetadata | null>(null)
const layers = ref<CropLayer[]>([])
const activeLayerId = ref<string>('')
const cropBoxAspectRatio = ref<number | null>(null)
const finalVideoAspectRatio = ref<number | null>(null)
const fitMode = ref<'cover' | 'contain' | 'fill'>('cover')
const audioTracks = ref<CustomAudioTrack[]>([])
const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(0.8)
const currentTime = ref(0)
const duration = ref(0)

const subtitleStyle = ref<SubtitleStyle>({
  font: 'Inter',
  size: 36,
  color: '#ffffff',
  position: 'bottom',
  background: true,
  bgColor: 'rgba(0,0,0,0.6)',
})
const subtitleText = ref('')

const settings = ref<ExportSettings>({
  fps: 30,
  includeAudio: true,
  autoSave: true,
  interpolation: 'linear',
  stackingDirection: 'vertical',
  useWorker: false,
})

const exportProgress = ref<ExportProgress>({
  status: 'idle',
  processedFrames: 0,
  totalFrames: 0,
  percentage: 0,
  elapsedTime: 0,
  estimatedTimeRemaining: 0,
  statusText: ''
})

const hasVideo = computed(() => !!videoMetadata.value)
const activeLayer = computed(() => layers.value.find(l => l.id === activeLayerId.value))
const interpolation = computed(() => settings.value.interpolation)

function getVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('video[aria-label="source-video"]')
}

// ── Interpolation ─────────────────────────────────────────────────

function interpolateCropBox(
  time: number,
  keyframes: { time: number; x: number; y: number; width: number; height: number }[],
  mode: InterpolationMode,
) {
  if (!keyframes.length) return { x: 0, y: 0, width: 1, height: 1 }
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)
  if (sorted.length === 1) return { x: sorted[0].x, y: sorted[0].y, width: sorted[0].width, height: sorted[0].height }
  if (time <= sorted[0].time) return { x: sorted[0].x, y: sorted[0].y, width: sorted[0].width, height: sorted[0].height }
  if (time >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1]
    return { x: last.x, y: last.y, width: last.width, height: last.height }
  }
  let prev = sorted[0]; let next = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time <= sorted[i + 1].time) { prev = sorted[i]; next = sorted[i + 1]; break }
  }
  const dur = next.time - prev.time
  const t = dur === 0 ? 0 : (time - prev.time) / dur
  let val = t
  if (mode === 'ease') val = t * t * (3 - 2 * t)
  else if (mode === 'step') val = t < 0.5 ? 0 : 1
  return {
    x: prev.x + (next.x - prev.x) * val,
    y: prev.y + (next.y - prev.y) * val,
    width: prev.width + (next.width - prev.width) * val,
    height: prev.height + (next.height - prev.height) * val,
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
}

// ── Video loading ─────────────────────────────────────────────────

function loadVideoUrl(name: string, url: string) {
  const el = getVideo()
  if (el) { el.src = url; el.load() }
  videoMetadata.value = { name, url, width: 1920, height: 1080, duration: 0, aspectRatio: 16 / 9 }
}

function loadVideoFile(file: File) {
  videoFile.value = file
  loadVideoUrl(file.name, URL.createObjectURL(file))
}

function loadDemoVideo(name: string, url: string) {
  videoFile.value = null
  loadVideoUrl(name, url)
}

function loadCustomVideoFromUrl(url: string) {
  let name = 'Stream'
  try {
    const parsed = new URL(url)
    const lastPart = parsed.pathname.substring(parsed.pathname.lastIndexOf('/') + 1)
    if (lastPart && lastPart.includes('.')) name = decodeURIComponent(lastPart)
  } catch { }
  videoFile.value = null
  loadVideoUrl(name, url)
}

function onVideoMetadataLoaded() {
  const el = getVideo()
  if (!el || !videoMetadata.value) return
  const v = videoMetadata.value
  v.width = el.videoWidth; v.height = el.videoHeight; v.duration = el.duration; v.aspectRatio = el.videoWidth / el.videoHeight
  duration.value = el.duration
  initDefaultLayers()
}

function initDefaultLayers() {
  layers.value = [{
    id: 'layer-1', name: 'Camera 1', color: LAYER_COLORS[0],
    keyframes: [{ id: 'kf-initial', time: 0, x: 0.35, y: 0.15, width: 0.3, height: 0.7 }],
  }]
  activeLayerId.value = 'layer-1'
}

// ── Playback ──────────────────────────────────────────────────────

function togglePlay() {
  const el = getVideo()
  if (!el) return
  if (el.paused) el.play().catch(() => { })
  else el.pause()
}

function seekFrames(count: number) {
  const el = getVideo()
  if (!el) return
  el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + count * (1 / 30)))
}

function setCurrentTime(time: number) {
  currentTime.value = time
  const el = getVideo()
  if (el) el.currentTime = time
}

function updateVolume(vol: number) {
  volume.value = vol
  const el = getVideo()
  if (el) { el.volume = vol; el.muted = vol === 0 }
}

function toggleMute() {
  const el = getVideo()
  if (!el) return
  el.muted = !el.muted
  volume.value = el.muted ? 0 : el.volume
}

// ── Crop box drag / resize ────────────────────────────────────────

let activeResizeHandle: string | null = null
let isDraggingBox = false
let startDragX = 0; let startDragY = 0
let startCropX = 0; let startCropY = 0; let startCropW = 0; let startCropH = 0

function handleBoxDragStart(e: PointerEvent) {
  if ((e.target as HTMLElement).classList.contains('handle')) return
  isDraggingBox = true; activeResizeHandle = null
  startDragX = e.clientX; startDragY = e.clientY
  const layer = layers.value.find(l => l.id === activeLayerId.value)
  if (!layer) return
  const crop = interpolateCropBox(currentTime.value, layer.keyframes, settings.value.interpolation)
  startCropX = crop.x; startCropY = crop.y; startCropW = crop.width; startCropH = crop.height
}

function handleResizeStart(e: PointerEvent, handle: string) {
  isDraggingBox = false; activeResizeHandle = handle
  startDragX = e.clientX; startDragY = e.clientY
  const layer = layers.value.find(l => l.id === activeLayerId.value)
  if (!layer) return
  const crop = interpolateCropBox(currentTime.value, layer.keyframes, settings.value.interpolation)
  startCropX = crop.x; startCropY = crop.y; startCropW = crop.width; startCropH = crop.height
}

function handleDragMove(e: PointerEvent, overlayWidth: number, overlayHeight: number): { x: number; y: number; w: number; h: number } | null {
  if (!isDraggingBox && !activeResizeHandle) return null
  const dx = (e.clientX - startDragX) / overlayWidth
  const dy = (e.clientY - startDragY) / overlayHeight

  let newX = startCropX; let newY = startCropY; let newW = startCropW; let newH = startCropH

  if (isDraggingBox) {
    newX = Math.max(0, Math.min(1 - startCropW, startCropX + dx))
    newY = Math.max(0, Math.min(1 - startCropH, startCropY + dy))
  } else if (activeResizeHandle) {
    const aspect = cropBoxAspectRatio.value
    const videoRatio = videoMetadata.value ? videoMetadata.value.width / videoMetadata.value.height : 16 / 9
    const normAspect = aspect !== null ? aspect / videoRatio : null

    switch (activeResizeHandle) {
      case 'e': case 'se':
        newW = Math.max(0.05, Math.min(1 - startCropX, startCropW + dx))
        newH = Math.max(0.05, Math.min(1 - startCropY, startCropH + dy))
        if (normAspect !== null) { if (newW / newH > normAspect) newW = newH * normAspect; else newH = newW / normAspect }
        break
      case 'w': case 'sw':
        if (activeResizeHandle === 'w') {
          newX = Math.max(0, Math.min(startCropX + startCropW - 0.05, startCropX + dx))
          newW = startCropW - (newX - startCropX)
          if (normAspect !== null) { newH = newW / normAspect; newY = startCropY + startCropH - newH; if (newY < 0) { newY = 0; newH = startCropY + startCropH; newW = newH * normAspect; newX = startCropX + startCropW - newW } }
        } else {
          newX = Math.max(0, Math.min(startCropX + startCropW - 0.05, startCropX + dx))
          newW = startCropW - (newX - startCropX)
          newH = Math.max(0.05, Math.min(1 - startCropY, startCropH + dy))
          if (normAspect !== null) { if (newW / newH > normAspect) { newW = newH * normAspect; newX = startCropX + startCropW - newW } else newH = newW / normAspect }
        }
        break
      case 'n': case 'ne':
        newY = Math.max(0, Math.min(startCropY + startCropH - 0.05, startCropY + dy))
        newH = startCropH - (newY - startCropY)
        if (normAspect !== null) { newW = newH * normAspect; newX = startCropX + startCropW - newW; if (newX < 0) { newX = 0; newW = startCropX + startCropW; newH = newW / normAspect; newY = startCropY + startCropH - newH } }
        else if (activeResizeHandle === 'ne') newW = Math.max(0.05, Math.min(1 - startCropX, startCropW + dx))
        break
      case 's':
        newH = Math.max(0.05, Math.min(1 - startCropY, startCropH + dy))
        if (normAspect !== null) { newW = newH * normAspect; newX = startCropX + startCropW - newW; if (newX < 0) { newX = 0; newW = startCropX + startCropW; newH = newW / normAspect } }
        break
      case 'nw':
        newX = Math.max(0, Math.min(startCropX + startCropW - 0.05, startCropX + dx))
        newW = startCropW - (newX - startCropX)
        newY = Math.max(0, Math.min(startCropY + startCropH - 0.05, startCropY + dy))
        newH = startCropH - (newY - startCropY)
        if (normAspect !== null) { if (newW / newH > normAspect) { newW = newH * normAspect; newX = startCropX + startCropW - newW } else { newH = newW / normAspect; newY = startCropY + startCropH - newH } }
        break
    }
  }
  updateActiveKeyframeProperties(newX, newY, newW, newH)
  return { x: newX, y: newY, w: newW, h: newH }
}

function handleDragEnd() {
  isDraggingBox = false
  activeResizeHandle = null
}

// ── Keyframe management ──────────────────────────────────────────

function updateActiveKeyframeProperties(x: number, y: number, w: number, h: number) {
  const layer = layers.value.find(l => l.id === activeLayerId.value)
  if (!layer) return
  const time = parseFloat(currentTime.value.toFixed(2))
  const threshold = 0.1
  const existingIndex = layer.keyframes.findIndex(kf => Math.abs(kf.time - time) <= threshold)
  if (existingIndex !== -1) {
    const kf = layer.keyframes[existingIndex]
    kf.x = x; kf.y = y; kf.width = w; kf.height = h; kf.time = time
  } else {
    layer.keyframes.push({ id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, time, x, y, width: w, height: h })
    layer.keyframes.sort((a, b) => a.time - b.time)
  }
}

function addOrUpdateKeyframeAtCurrentTime() {
  const layer = layers.value.find(l => l.id === activeLayerId.value)
  if (!layer) return
  const time = parseFloat(currentTime.value.toFixed(2))
  const currentCrop = interpolateCropBox(time, layer.keyframes, settings.value.interpolation)
  const existing = layer.keyframes.find(kf => Math.abs(kf.time - time) <= 0.1)
  if (existing) existing.time = time
  else {
    layer.keyframes.push({ id: `kf-${Date.now()}`, time, x: currentCrop.x, y: currentCrop.y, width: currentCrop.width, height: currentCrop.height })
    layer.keyframes.sort((a, b) => a.time - b.time)
  }
}

function removeKeyframeAtCurrentTime() {
  const layer = layers.value.find(l => l.id === activeLayerId.value)
  if (!layer || layer.keyframes.length <= 1) return
  layer.keyframes = layer.keyframes.filter(kf => Math.abs(kf.time - currentTime.value) > 0.25 || kf.id === 'kf-initial')
}

function clearActiveLayerTrajectory() {
  const layer = layers.value.find(l => l.id === activeLayerId.value)
  if (!layer) return
  layer.keyframes = [{ id: 'kf-initial', time: 0, x: 0.35, y: 0.15, width: 0.3, height: 0.7 }]
}

function applyCropBoxAspectRatio() {
  const layer = layers.value.find(l => l.id === activeLayerId.value)
  const vm = videoMetadata.value
  if (!layer || !vm) return
  const crop = interpolateCropBox(currentTime.value, layer.keyframes, settings.value.interpolation)
  let w = crop.width; let h = crop.height
  if (cropBoxAspectRatio.value !== null) {
    const normRatio = cropBoxAspectRatio.value / vm.aspectRatio
    h = w / normRatio
    if (crop.y + h > 1) { h = 1 - crop.y; w = h * normRatio }
  }
  updateActiveKeyframeProperties(crop.x, crop.y, w, h)
}

// ── Layer management ──────────────────────────────────────────────

function createNewLayer() {
  if (layers.value.length >= 5) return false
  const id = `layer-${Date.now()}`
  const idx = layers.value.length
  layers.value.push({
    id, name: `Camera ${idx + 1}`, color: LAYER_COLORS[idx % LAYER_COLORS.length],
    keyframes: [{ id: `kf-initial-${Date.now()}`, time: 0, x: 0.1 + idx * 0.15, y: 0.2, width: 0.3, height: 0.6 }],
  })
  activeLayerId.value = id
  return true
}

function deleteLayer(id: string) {
  if (layers.value.length <= 1) return
  layers.value = layers.value.filter(l => l.id !== id)
  if (activeLayerId.value === id) activeLayerId.value = layers.value[0].id
  layers.value.forEach((l, i) => { l.name = `Camera ${i + 1}` })
}

function selectLayer(id: string) {
  activeLayerId.value = id
}

function setStackingDirection(dir: StackingDirection) {
  settings.value.stackingDirection = dir
}

// ── Audio ─────────────────────────────────────────────────────────

function addAudioTrack(track: CustomAudioTrack) {
  audioTracks.value.push(track)
}

function removeAudioTrack(id: string) {
  audioTracks.value = audioTracks.value.filter(t => t.id !== id)
}

// ── Extract thumbnail ─────────────────────────────────────────────

function extractThumbnail() {
  const el = getVideo()
  if (!videoMetadata.value || !el) return
  const ratio = finalVideoAspectRatio.value !== null ? finalVideoAspectRatio.value : videoMetadata.value.aspectRatio
  const maxDim = 1280
  let exportWidth = videoMetadata.value.width; let exportHeight = videoMetadata.value.height
  if (finalVideoAspectRatio.value !== null) {
    if (ratio < videoMetadata.value.aspectRatio) { exportHeight = videoMetadata.value.height; exportWidth = exportHeight * ratio }
    else { exportWidth = videoMetadata.value.width; exportHeight = exportWidth / ratio }
  }
  if (exportWidth > maxDim || exportHeight > maxDim) {
    const scale = maxDim / Math.max(exportWidth, exportHeight)
    exportWidth = Math.round(exportWidth * scale); exportHeight = Math.round(exportHeight * scale)
  }
  exportWidth = Math.round(exportWidth / 2) * 2; exportHeight = Math.round(exportHeight / 2) * 2
  const canvas = document.createElement('canvas')
  canvas.width = exportWidth; canvas.height = exportHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#0a0a0b'; ctx.fillRect(0, 0, exportWidth, exportHeight)
  const time = currentTime.value; const N = layers.value.length
  const stacking = settings.value.stackingDirection; const interp = settings.value.interpolation; const currentFit = fitMode.value
  layers.value.forEach((layer, index) => {
    const crop = interpolateCropBox(time, layer.keyframes, interp)
    const sx = crop.x * videoMetadata.value!.width; const sy = crop.y * videoMetadata.value!.height
    const sW = crop.width * videoMetadata.value!.width; const sH = crop.height * videoMetadata.value!.height
    if (sW <= 0 || sH <= 0) return
    let dx = 0; let dy = 0; let dW = exportWidth; let dH = exportHeight
    if (stacking === 'vertical') { dH = exportHeight / N; dy = index * dH } else { dW = exportWidth / N; dx = index * dW }
    let fSx = sx; let fSy = sy; let fSW = sW; let fSH = sH; let dX = dx; let dY = dy; let dW2 = dW; let dH2 = dH
    if (currentFit === 'cover') {
      const srcA = sW / sH; const dstA = dW / dH
      if (srcA > dstA) { fSW = sH * dstA; fSx = sx + (sW - fSW) / 2 } else if (srcA < dstA) { fSH = sW / dstA; fSy = sy + (sH - fSH) / 2 }
    } else if (currentFit === 'contain') {
      const srcA = sW / sH; const dstA = dW / dH
      if (srcA > dstA) { const aH = dW / srcA; dY += (dH - aH) / 2; dH2 = aH } else { const aW = dH * srcA; dX += (dW - aW) / 2; dW2 = aW }
    }
    ctx.drawImage(el, fSx, fSy, fSW, fSH, dX, dY, dW2, dH2)
    if (index > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 3.5; ctx.beginPath()
      if (stacking === 'vertical') { ctx.moveTo(0, dy); ctx.lineTo(exportWidth, dy) } else { ctx.moveTo(dx, 0); ctx.lineTo(dx, exportHeight) }
      ctx.stroke()
    }
  })
  const a = document.createElement('a')
  a.download = `thumbnail-${time.toFixed(1)}s.png`
  a.href = canvas.toDataURL('image/png')
  a.click()
}

// ── Reset ─────────────────────────────────────────────────────────

function restartSession() {
  videoFile.value = null; videoMetadata.value = null
  layers.value = []; activeLayerId.value = ''
  cropBoxAspectRatio.value = null; finalVideoAspectRatio.value = null; fitMode.value = 'cover'
  audioTracks.value = []; subtitleText.value = ''
  currentTime.value = 0; duration.value = 0; isPlaying.value = false
  exportProgress.value = { status: 'idle', statusText: '', processedFrames: 0, totalFrames: 0, percentage: 0, elapsedTime: 0, estimatedTimeRemaining: 0 }
  const el = getVideo()
  if (el) { el.pause(); el.removeAttribute('src') }
}

// ── Keyboard handler (call from index.vue) ─────────────────────────

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); seekFrames(-1) }
  else if (e.code === 'ArrowRight') { e.preventDefault(); seekFrames(1) }
}

// ── Public API ────────────────────────────────────────────────────

export function useVideoCropper() {
  return {
    // State
    videoFile, videoMetadata, layers, activeLayerId,
    cropBoxAspectRatio, finalVideoAspectRatio, fitMode,
    audioTracks, isPlaying, isMuted, volume, currentTime, duration,
    subtitleStyle, subtitleText, settings, exportProgress,
    hasVideo, activeLayer, interpolation,

    // Video loading
    loadVideoFile, loadVideoUrl, loadDemoVideo, loadCustomVideoFromUrl,
    onVideoMetadataLoaded, initDefaultLayers,

    // Playback
    togglePlay, seekFrames, setCurrentTime, updateVolume, toggleMute, formatTime,

    // Crop interaction
    handleBoxDragStart, handleResizeStart, handleDragMove, handleDragEnd,
    interpolateCropBox,

    // Keyframes
    updateActiveKeyframeProperties, addOrUpdateKeyframeAtCurrentTime,
    removeKeyframeAtCurrentTime, clearActiveLayerTrajectory,
    applyCropBoxAspectRatio,

    // Layers
    createNewLayer, deleteLayer, selectLayer, setStackingDirection,

    // Audio
    addAudioTrack, removeAudioTrack,

    // Actions
    extractThumbnail, restartSession, handleGlobalKeydown,

    // Helpers
    getVideo,
  }
}
