<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { objectAnimation } from '../../../../shared/image-editor/studio-canvas'
import { useDesignMp4Export } from '../../../composables/tools/image-editor/useDesignMp4Export'
import { useDesignStudio } from '../../../composables/tools/image-editor/useDesignStudio'

/** Animation catalogs (shared between this preview and the server renderer). */
const ENTER_ANIMATIONS = ['fadeIn', 'riseUp', 'dropDown', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'wipeUp', 'pop', 'none'] as const
const LOOP_ANIMATIONS = ['none', 'pulse', 'spin', 'bob', 'swing', 'blink'] as const
const PAGE_TRANSITIONS = ['none', 'fade', 'slideLeft', 'slideRight', 'wipeUp', 'zoomIn'] as const

/**
 * Timeline panel - per-layer enter/exit/loop animations, page transition,
 * duration, playback preview (same evaluator the server renderer uses) and a
 * simple pages strip.
 */

interface RowAnim {
  enterType: string
  enterDuration: number
  enterDelay: number
  exitType: string
  exitDuration: number
  exitDelay: number
  loopType: string
  loopDuration: number
}

const { t } = useI18n()
const { editor, timelineOpen } = useFabricJs()
const designStudio = useDesignStudio()

const pageDurationSec = ref(4)
const pageDuration = computed(() => Math.round(pageDurationSec.value * 1000))
const transition = ref({ type: 'none', duration: 600 })
const playing = ref(false)
const { exportingMp4, exportMp4 } = useDesignMp4Export()
const anims = ref<Record<string, RowAnim>>({})
const selectedId = ref<string | null>(null)
const pageAudio = ref<{ url: string; name?: string; volume?: number } | null>(null)
const audioUploading = ref(false)
const audioInput = ref<HTMLInputElement | null>(null)
let audioEl: HTMLAudioElement | null = null
let audioSaveTimer: ReturnType<typeof setTimeout> | null = null

const TRANSITION_OPTIONS = PAGE_TRANSITIONS.map(value => ({ label: t(`studio.timeline.transition.${value}`), value }))
const ENTER_OPTIONS = ENTER_ANIMATIONS.map(value => ({ label: t(`studio.timeline.enter.${value}`), value }))
const LOOP_OPTIONS = LOOP_ANIMATIONS.map(value => ({ label: t(`studio.timeline.loop.${value}`), value }))

const ANIMATION_PRESETS = [
  { id: 'fade', enter: 'fadeIn', duration: 600, loop: 'none' },
  { id: 'rise', enter: 'riseUp', duration: 600, loop: 'none' },
  { id: 'slide', enter: 'slideLeft', duration: 600, loop: 'none' },
  { id: 'pop', enter: 'pop', duration: 500, loop: 'none' },
  { id: 'zoom', enter: 'zoomOut', duration: 700, loop: 'none' },
  { id: 'pulse', enter: 'none', duration: 1600, loop: 'pulse' },
  { id: 'float', enter: 'none', duration: 2200, loop: 'bob' },
] as const

interface CanvasRow {
  id?: string
  name?: string
  type?: string
  videoUrl?: string
}

const layers = ref<CanvasRow[]>([])

/** Freshly added text/shape/video layers have no id yet; animations need one. */
function ensureLayerId(object: unknown): string {
  const record = object as { id?: string }
  if (!record.id) record.id = `layer-${Math.random().toString(36).slice(2, 9)}`
  return record.id
}

function refreshLayers(): void {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  layers.value = canvas.getObjects()
    .filter(obj => !['workspace', '__background'].includes((obj as { id?: string }).id ?? ''))
    .map(obj => ({
      id: ensureLayerId(obj),
      name: (obj as { name?: string }).name,
      type: String((obj as { type?: string }).type ?? ''),
      videoUrl: (obj as { videoUrl?: string }).videoUrl,
    }))
}

const selected = computed(() => anims.value[selectedId.value ?? ''] ?? null)

const layerIcon: Record<string, string> = {
  image: 'lucide:image', textbox: 'lucide:type', 'i-text': 'lucide:type', rect: 'lucide:square', circle: 'lucide:circle', path: 'lucide:pencil',
}

const LAYER_KIND: Record<string, string> = {
  image: 'image', textbox: 'text', 'i-text': 'text', itext: 'text', text: 'text',
  rect: 'rect', circle: 'circle', triangle: 'triangle', path: 'path',
}

function layerLabel(row: CanvasRow): string {
  if (row.videoUrl) return t('panel.layerKind.video')
  return row.name || t(`panel.layerKind.${LAYER_KIND[row.type ?? ''] ?? 'object'}`)
}

function rowIcon(row: CanvasRow): string {
  return row.videoUrl ? 'lucide:film' : (layerIcon[row.type ?? ''] ?? 'lucide:box')
}

function pickLayer(row: CanvasRow): void {
  selectedId.value = row.id ?? null
  const canvas = editor.value?.fabricCanvas
  const target = canvas?.getObjects().find(obj => (obj as { id?: string }).id === selectedId.value)
  if (target && canvas) {
    canvas.setActiveObject(target)
    canvas.requestRenderAll()
  }
}

function rowAnim(row: CanvasRow): RowAnim {
  const canvas = editor.value?.fabricCanvas
  const obj = canvas?.getObjects().find(item => (item as { id?: string }).id === row.id)
  const stored = obj ? objectAnimation(obj as never) : undefined
  return {
    enterType: stored?.enter?.type ?? 'none',
    enterDuration: stored?.enter?.duration ?? 600,
    enterDelay: stored?.enter?.delay ?? 0,
    exitType: stored?.exit?.type ?? 'none',
    exitDuration: stored?.exit?.duration ?? 500,
    exitDelay: stored?.exit?.delay ?? 0,
    loopType: stored?.loop?.type ?? 'none',
    loopDuration: stored?.loop?.duration ?? 1600,
  }
}

function ensureAnim(row: CanvasRow): RowAnim {
  if (!anims.value[row.id ?? '']) anims.value[row.id ?? ''] = rowAnim(row)
  return anims.value[row.id ?? ''] ?? rowAnim(row)
}

function persist(row: CanvasRow): void {
  const values = anims.value[row.id ?? '']
  if (!values || !row.id) return
  const payload = {
    ...(values.enterType !== 'none' ? { enter: { type: values.enterType, duration: values.enterDuration, delay: values.enterDelay, easing: 'easeOutCubic' } } : {}),
    ...(values.exitType !== 'none' ? { exit: { type: values.exitType, duration: values.exitDuration, delay: values.exitDelay, easing: 'easeInCubic' } } : {}),
    ...(values.loopType !== 'none' ? { loop: { type: values.loopType, duration: values.loopDuration, easing: 'easeInOutSine' } } : {}),
  }
  const plugin = editor.value?.getPlugin?.('studio') as { setLayerAnimation?: (id: string, spec: never) => void } | undefined
  plugin?.setLayerAnimation?.(row.id, payload as never)
}

async function playPreview(): Promise<void> {
  const plugin = editor.value?.getPlugin?.('animation') as { playPreview?: (ms: number) => Promise<void>; stopPreview?: () => void } | undefined
  if (!plugin) return
  playing.value = true
  startAudio()
  try {
    await plugin.playPreview?.(pageDuration.value)
  } finally {
    stopAudio()
    playing.value = false
  }
}

function stopPreview(): void {
  stopAudio()
  const plugin = editor.value?.getPlugin?.('animation') as { stopPreview?: () => void } | undefined
  plugin?.stopPreview?.()
  playing.value = false
}

function stopAudio(): void {
  if (!audioEl) return
  audioEl.pause()
  audioEl = null
}

function startAudio(): void {
  if (!pageAudio.value?.url) return
  audioEl = new Audio(pageAudio.value.url)
  audioEl.volume = Math.min(1, Math.max(0, (pageAudio.value.volume ?? 100) / 100))
  audioEl.currentTime = 0
  void audioEl.play().catch(() => {})
}

function syncAudio(): void {
  const plugin = editor.value?.getPlugin?.('studio') as { getPageAudio?: () => { url: string; name?: string; volume?: number } | null } | undefined
  const stored = plugin?.getPageAudio?.() ?? null
  pageAudio.value = stored ? { ...stored, volume: stored.volume ?? 100 } : null
}

function applyAudio(audio: { url: string; name?: string; volume?: number } | null): void {
  const plugin = editor.value?.getPlugin?.('studio') as { setPageAudio?: (value: { url: string; name?: string; volume?: number } | null) => void } | undefined
  plugin?.setPageAudio?.(audio)
  syncAudio()
  designStudio.markDirty()
  if (!designStudio.currentId.value) return
  if (audioSaveTimer) clearTimeout(audioSaveTimer)
  audioSaveTimer = setTimeout(() => {
    audioSaveTimer = null
    void designStudio.saveDesign({ silent: true })
  }, 600)
}

function triggerAudioInput(): void {
  audioInput.value?.click()
}

async function handleAudioUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  audioUploading.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await $fetch<{ url: string; name: string }>('/api/v1/image-editor/assets', { method: 'POST', body: form })
    applyAudio({ url: response.url, name: file.name, volume: 100 })
    useToast().add({ title: t('studio.timeline.audioUploaded'), color: 'success', icon: 'i-lucide-music' })
  } catch {
    useToast().add({ title: t('studio.timeline.audioFailed'), color: 'error', icon: 'i-lucide-x-circle' })
  }
  audioUploading.value = false
  input.value = ''
}

function removeAudio(): void {
  applyAudio(null)
}

function updateAudioVolume(value: number | number[]): void {
  if (!pageAudio.value) return
  const volume = Array.isArray(value) ? value[0] ?? 100 : value
  if (audioEl) audioEl.volume = Math.min(1, Math.max(0, volume / 100))
  applyAudio({ ...pageAudio.value, volume })
}

function applyTransition(): void {
  const plugin = editor.value?.getPlugin?.('studio') as { setPageTransition?: (type: string, duration: number) => void } | undefined
  plugin?.setPageTransition?.(transition.value.type, transition.value.duration)
}

function applyDuration(): void {
  const plugin = editor.value?.getPlugin?.('studio') as { setPageDuration?: (ms: number) => void } | undefined
  const clamped = Math.min(10, Math.max(0.5, Number(pageDurationSec.value) || 4))
  pageDurationSec.value = clamped
  plugin?.setPageDuration?.(Math.round(clamped * 1000))
}

watch(() => editor.value?.state.value, () => {
  syncDuration()
  syncAudio()
})

onMounted(() => {
  syncDuration()
  syncAudio()
  refreshLayers()
  const canvas = editor.value?.fabricCanvas
  canvas?.on('object:added', refreshLayers)
  canvas?.on('object:removed', refreshLayers)
})

onUnmounted(() => {
  const canvas = editor.value?.fabricCanvas
  canvas?.off('object:added', refreshLayers)
  canvas?.off('object:removed', refreshLayers)
  stopPreview()
  stopAudio()
})

function closeEditor(): void {
  selectedId.value = null
}

function isAnimated(row: CanvasRow): boolean {
  const values = rowAnim(row)
  return (values.enterType && values.enterType !== 'none') || (values.loopType && values.loopType !== 'none')
}

function toggleAnimated(row: CanvasRow, enabled: boolean): void {
  if (!enabled) {
    setField(row, 'enterType', 'none')
    setField(row, 'exitType', 'none')
    setField(row, 'loopType', 'none')
    return
  }
  const values = rowAnim(row)
  if (!values.enterType || values.enterType === 'none') setField(row, 'enterType', 'fadeIn')
}

function applyPreset(row: CanvasRow, preset: typeof ANIMATION_PRESETS[number]): void {
  if (preset.loop !== 'none') {
    setField(row, 'enterType', 'none')
    setField(row, 'loopType', preset.loop)
    setField(row, 'loopDuration', preset.duration)
    return
  }
  setField(row, 'loopType', 'none')
  setField(row, 'enterType', preset.enter)
  setField(row, 'enterDuration', preset.duration)
  setField(row, 'enterDelay', 0)
}

function syncDuration(): void {
  const plugin = editor.value?.getPlugin?.('studio') as { getPageDuration?: () => number } | undefined
  const ms = plugin?.getPageDuration?.() ?? 4000
  pageDurationSec.value = Math.max(0.5, Math.round(ms / 100) / 10)
}

function openTimelineBar(): void {
  timelineOpen.value = true
}

const selectedRow = computed(() => layers.value.find(row => row.id === selectedId.value) ?? null)

watch(selectedId, (id) => {
  const row = layers.value.find(entry => entry.id === id)
  if (row) anims.value[row.id ?? ''] = rowAnim(row)
})

function setField(row: CanvasRow, key: keyof RowAnim, value: number | string): void {
  const current = anims.value[row.id ?? ''] ?? ensureAnim(row)
  anims.value[row.id ?? ''] = { ...current, [key]: value } as RowAnim
  persist(row)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <UButton size="xs" color="primary" variant="soft" icon="lucide:play" :loading="playing" @click="playPreview">
        {{ t('studio.timeline.preview') }}
      </UButton>
      <UButton size="xs" variant="ghost" color="neutral" icon="lucide:square" :disabled="!playing" @click="stopPreview">
        {{ t('common.stop') }}
      </UButton>
      <UButton size="xs" variant="outline" color="neutral" icon="lucide:gallery-horizontal-end" @click="openTimelineBar">
        {{ t('studio.timeline.openBar') }}
      </UButton>
      <UButton size="xs" variant="ghost" color="neutral" icon="lucide:download" :loading="exportingMp4" @click="exportMp4">
        {{ t('studio.timeline.mp4') }}
      </UButton>
    </div>

    <!-- page timing -->
    <div class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2.5">
      <div>
        <div class="flex items-center justify-between mb-1 gap-2">
          <span class="text-xs text-toned">{{ t('studio.timeline.pageDuration') }}</span>
          <div class="flex items-center gap-1">
            <UInput v-model.number="pageDurationSec" type="number" min="0.5" max="10" step="0.5" size="xs" class="w-16" @change="applyDuration" />
            <span class="text-[11px] text-muted">s</span>
          </div>
        </div>
        <USlider v-model="pageDurationSec" :min="0.5" :max="10" :step="0.5" size="xs" @change="applyDuration" />
      </div>
      <div class="flex gap-2 items-end">
        <UFormField :label="t('studio.timeline.transitionLabel')" size="xs" class="flex-1">
          <USelect v-model="transition.type" :items="TRANSITION_OPTIONS" size="xs" @change="applyTransition" />
        </UFormField>
        <UFormField :label="t('studio.timeline.transitionMs')" size="xs" class="w-20">
          <UInput v-model.number="transition.duration" type="number" size="xs" @change="applyTransition" />
        </UFormField>
      </div>
    </div>

    <!-- audio track -->
    <div class="rounded-xl border border-default bg-elevated/50 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.timeline.audio') }}</h3>
        <span class="truncate text-[10px] text-muted">{{ pageAudio?.name }}</span>
      </div>
      <input
        ref="audioInput" type="file" class="hidden" data-testid="audio-input"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" @change="handleAudioUpload">
      <template v-if="pageAudio">
        <div class="flex items-center gap-2">
          <span class="shrink-0 text-[11px] text-muted">{{ t('studio.timeline.audioVolume') }}</span>
          <USlider
            :model-value="pageAudio.volume ?? 100" :min="0" :max="100" size="xs" class="flex-1"
            @update:model-value="updateAudioVolume" />
          <span class="w-9 text-right font-mono text-[10px]">{{ pageAudio.volume ?? 100 }}%</span>
        </div>
        <UButton size="xs" variant="ghost" color="error" icon="lucide:trash-2" block @click="removeAudio">
          {{ t('studio.timeline.audioRemove') }}
        </UButton>
      </template>
      <UButton
        v-else block size="xs" variant="soft" color="primary" icon="lucide:music"
        :loading="audioUploading" data-testid="audio-add" @click="triggerAudioInput">
        {{ t('studio.timeline.audioAdd') }}
      </UButton>
      <p class="text-[10px] leading-tight text-muted">{{ t('studio.timeline.audioHint') }}</p>
    </div>

    <!-- layers list -->
    <div class="flex items-center justify-between">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.timeline.layers') }}</h3>
      <UButton size="xs" variant="ghost" icon="lucide:refresh-ccw" :aria-label="t('studio.timeline.refresh')" @click="refreshLayers" />
    </div>

    <div class="space-y-1.5">
      <div
        v-for="row in layers" :key="row.id"
        class="flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors"
        :class="selectedId === row.id ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:border-default'"
        @click="pickLayer(row)">
        <div class="w-7 h-7 rounded-md bg-elevated flex items-center justify-center border border-default shrink-0">
          <Icon :name="rowIcon(row)" class="w-3.5 h-3.5 text-muted" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs truncate">{{ layerLabel(row) }}</div>
        </div>
        <UBadge v-if="row.id && anims[row.id]" size="sm" variant="subtle" color="primary">Aa</UBadge>
        <USwitch
          :model-value="isAnimated(row)" size="xs"
          :aria-label="t('studio.timeline.animate')"
          @update:model-value="value => toggleAnimated(row, Boolean(value))" />
      </div>
      <UAlert v-if="layers.length === 0" color="neutral" variant="soft" icon="i-lucide-film" :title="t('studio.timeline.noLayers')" />
    </div>

    <!-- selected editor -->
    <div v-if="selectedRow" class="rounded-xl border border-primary/30 bg-elevated/60 p-3 space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold font-mono truncate">{{ layerLabel(selectedRow) }}</span>
        <UButton size="xs" variant="ghost" icon="lucide:x" :aria-label="t('common.close')" @click="closeEditor" />
      </div>

      <template v-if="selected">
        <UFormField :label="t('studio.timeline.enterAnim')" size="xs">
          <USelect :model-value="selected.enterType" :items="ENTER_OPTIONS" size="xs" @update:model-value="value => setField(selectedRow, 'enterType', String(value))" />
        </UFormField>
        <div class="flex gap-2">
          <UFormField :label="t('studio.timeline.enterMs')" size="xs" class="flex-1">
            <UInput :model-value="selected.enterDuration" type="number" size="xs" @change="value => setField(selectedRow, 'enterDuration', Number(value) || 600)" />
          </UFormField>
          <UFormField :label="t('studio.timeline.delayMs')" size="xs" class="flex-1">
            <UInput :model-value="selected.enterDelay" type="number" size="xs" @change="value => setField(selectedRow, 'enterDelay', Number(value) || 0)" />
          </UFormField>
        </div>
        <div class="space-y-1">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">{{ t('studio.timeline.presets') }}</div>
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="preset in ANIMATION_PRESETS" :key="preset.id"
              size="xs" variant="soft" color="neutral"
              @click="applyPreset(selectedRow, preset)">
              {{ t(`studio.timeline.preset.${preset.id}`) }}
            </UButton>
          </div>
        </div>
        <UFormField :label="t('studio.timeline.exitAnim')" size="xs">
          <USelect :model-value="selected.exitType" :items="ENTER_OPTIONS" size="xs" @update:model-value="value => setField(selectedRow, 'exitType', String(value))" />
        </UFormField>
        <div class="flex gap-2">
          <UFormField :label="t('studio.timeline.exitMs')" size="xs" class="flex-1">
            <UInput :model-value="selected.exitDuration" type="number" size="xs" @change="value => setField(selectedRow, 'exitDuration', Number(value) || 500)" />
          </UFormField>
          <UFormField :label="t('studio.timeline.delayMs')" size="xs" class="flex-1">
            <UInput :model-value="selected.exitDelay" type="number" size="xs" @change="value => setField(selectedRow, 'exitDelay', Number(value) || 0)" />
          </UFormField>
        </div>
        <UFormField :label="t('studio.timeline.loopAnim')" size="xs">
          <USelect :model-value="selected.loopType" :items="LOOP_OPTIONS" size="xs" @update:model-value="value => setField(selectedRow, 'loopType', String(value))" />
        </UFormField>
      </template>
    </div>
  </div>
</template>
