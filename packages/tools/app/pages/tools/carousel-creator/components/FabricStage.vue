<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import type { FabricSlideScene } from '../../../../../shared/carousel-scene/scene'
import { buildImageObject, buildSyncObject, type FabricModule, type PaintedEntry } from '../../../../../shared/carousel-scene/fabric-build'

/**
 * FabricStage — fabric renderer + lightweight editor for one slide scene.
 *
 * Takes the isomorphic scene JSON from `slideToFabricScene()` and paints it
 * on a fabric canvas (browser side of the Task 1.5 server-renderer contract).
 * Engine descriptors (`Scene*`) and `HtmlUnsupported` markers are counted and
 * skipped, never painted. Images that fail to load are skipped the same way.
 *
 * With `editable`, objects (except the background) are selectable and edits
 * write back via `select` / `modify` — the parent owns layer state, the stage
 * stays a pure function of `scene` (rebuilt + reselected after each change).
 */
const props = withDefaults(defineProps<{
  scene: FabricSlideScene | null
  editable?: boolean
  selectedIndex?: number | null
}>(), { editable: false, selectedIndex: null })

const emit = defineEmits<{
  select: [index: number | null]
  modify: [index: number, patch: { x: number, y: number, w: number, h?: number, rotate: number }]
}>()

const { t } = useI18n()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const rendered = ref(0)
const skipped = ref(0)
const ready = ref(false)
const renderSeq = ref(0)
/** Painted "Type:fill" inventory for e2e (stronger than counts). */
const paintLedger = ref('')
let canvas: import('fabric').Canvas | null = null

function isInteractive(editable: boolean, type: string): boolean {
  return editable && type !== 'background'
}

function activeLayerIndex(target: import('fabric').Canvas): number | null {
  const index = (target.getActiveObject() as { layerIndex?: unknown } | undefined)?.layerIndex
  return typeof index === 'number' ? index : null
}

function fireModify(target: import('fabric').Canvas, raw: unknown): { index: number, patch: { x: number, y: number, w: number, h?: number, rotate: number } } | null {
  const obj = (raw as { left?: unknown, top?: unknown, angle?: unknown, width?: unknown, height?: unknown, scaleX?: unknown, scaleY?: unknown, type?: unknown, layerIndex?: unknown } | undefined)
  if (!obj) return null
  if (typeof obj.layerIndex !== 'number') return null
  const patch = {
    x: Number(obj.left ?? 0),
    y: Number(obj.top ?? 0),
    rotate: Number(obj.angle ?? 0),
    w: Number(obj.width ?? 0) * Number(obj.scaleX ?? 1),
    ...(obj.type === 'Textbox' ? {} : { h: Number(obj.height ?? 0) * Number(obj.scaleY ?? 1) }),
  }
  return { index: obj.layerIndex, patch }
}

function restoreSelection(target: import('fabric').Canvas, painted: PaintedEntry[], selectedIndex: number | null, editable: boolean): void {
  if (!editable || selectedIndex == null) return
  const match = painted.find(p => p.layerIndex === selectedIndex)
  if (match) target.setActiveObject(match.obj)
}

function ensureCanvas(F: FabricModule, el: HTMLCanvasElement, width: number, height: number, selection: boolean): import('fabric').Canvas {
  if (canvas) {
    canvas.dispose()
    canvas = null
  }
  canvas = new F.Canvas(el, { width, height, selection, renderOnAddRemove: false })
  return canvas
}

async function renderScene(): Promise<void> {
  const el = canvasEl.value
  const scene = props.scene
  ready.value = false
  rendered.value = 0
  skipped.value = 0
  if (!el || !scene) return
  const F = await import('fabric')

  const target = ensureCanvas(F, el, scene.width, scene.height, props.editable)
  const emitModify = (e: { target?: unknown }): void => {
    const change = fireModify(target, e.target)
    if (change) emit('modify', change.index, change.patch)
  }
  target.on('selection:created', () => emit('select', activeLayerIndex(target)))
  target.on('selection:updated', () => emit('select', activeLayerIndex(target)))
  target.on('selection:cleared', () => emit('select', null))
  target.on('object:modified', e => emitModify(e))
  const painted: PaintedEntry[] = []
  for (const obj of scene.objects) {
    const built = obj.type === 'Image' ? await buildImageObject(F, obj, scene.width) : buildSyncObject(F, obj)
    if (built) {
      const interactive = isInteractive(props.editable, obj.type)
      built.selectable = interactive
      built.evented = interactive
      ;(built as { layerIndex?: unknown }).layerIndex = obj.layerIndex
      target.add(built)
      painted.push({ layerIndex: Number(obj.layerIndex ?? -1), obj: built })
      rendered.value += 1
    } else {
      skipped.value += 1
    }
  }
  target.renderAll()
  restoreSelection(target, painted, props.selectedIndex, props.editable)
  paintLedger.value = target.getObjects().map((o) => {
    const t = `${o.type}:${typeof o.fill === 'string' ? o.fill : 'complex'}@${Math.round(o.left ?? -1)},${Math.round(o.top ?? -1)},${Math.round((o.width ?? 0) * (o.scaleX ?? 1))}x${Math.round((o.height ?? 0) * (o.scaleY ?? 1))}`
    return t
  }).join('|')
  ready.value = true
  renderSeq.value += 1
}

watch(() => props.scene, () => {
  void renderScene()
}, { immediate: false })

onMounted(() => {
  void renderScene()
})

onUnmounted(() => {
  if (canvas) {
    canvas.dispose()
    canvas = null
  }
})
</script>

<template>
  <div data-testid="fabric-stage" class="fabric-wrap" :data-rendered="rendered" :data-skipped="skipped" :data-ready="ready" :data-render-seq="renderSeq" :data-paint="paintLedger" :data-selected="selectedIndex ?? -1">
    <p v-if="!scene" class="text-xs text-muted px-1">{{ t('fabric.legacyHint') }}</p>
    <template v-else>
      <canvas ref="canvasEl" class="fabric-canvas" />
      <p v-if="ready && skipped > 0" class="text-[11px] text-muted px-1 pt-1">{{ t('fabric.skipped', { count: skipped }) }}</p>
    </template>
  </div>
</template>

<style scoped>
/* Fabric fixes the wrapper at full design resolution (1080×1350) — scale the
   whole stage down to the column while keeping aspect. :deep is required:
   the wrapper + upper canvas are created by fabric at runtime and carry no
   SFC scope attribute. */
.fabric-wrap :deep(.canvas-container) {
  max-width: 100% !important;
  height: auto !important;
}
.fabric-wrap :deep(canvas) {
  max-width: 100% !important;
  height: auto !important;
}
</style>
