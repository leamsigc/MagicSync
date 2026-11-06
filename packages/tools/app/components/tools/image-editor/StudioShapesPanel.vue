<i18n src="#site/app/pages/tools/image-editor/ImageEditor.json"></i18n>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { FabricImage, Path, Rect, Circle, Ellipse, Triangle, Line, Polygon, Polyline, Textbox, Text, loadSVGFromString, util } from 'fabric'
import { useFabricJs } from '../../../composables/tools/image-editor/useFabricJs'
import { SHAPE_CATALOG, SHAPE_CATEGORIES, type ShapeEntry } from '../../../../shared/image-editor/shapes'
import { shapeInsertSpec } from '../../../../shared/image-editor/studio-canvas'

/**
 * Shapes panel — the shared shape pack (28 shapes) + Iconify icon search.
 * Inserts are fabric objects; SVG icons arrive as fabricated Images.
 */

const { t } = useI18n()
const { editor } = useFabricJs()

const category = ref<typeof SHAPE_CATEGORIES[number]>('basic')
const iconQuery = ref('')
const qrData = ref('')
const qrBusy = ref(false)
const svgInput = ref<HTMLInputElement>()

const PRIMITIVES = [
  { id: 'textbox', label: 'studio.shapes.primitive.textbox', icon: 'lucide:type' },
  { id: 'rect', label: 'studio.shapes.primitive.rect', icon: 'lucide:square' },
  { id: 'circle', label: 'studio.shapes.primitive.circle', icon: 'lucide:circle' },
  { id: 'ellipse', label: 'studio.shapes.primitive.ellipse', icon: 'lucide:circle-dashed' },
  { id: 'triangle', label: 'studio.shapes.primitive.triangle', icon: 'lucide:triangle' },
  { id: 'line', label: 'studio.shapes.primitive.line', icon: 'lucide:minus' },
  { id: 'polygon', label: 'studio.shapes.primitive.polygon', icon: 'lucide:hexagon' },
  { id: 'polyline', label: 'studio.shapes.primitive.polyline', icon: 'lucide:activity' },
]

function addPrimitive(kind: string): void {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  let object
  if (kind === 'textbox') object = new Textbox('Edit this text', { left: 120, top: 120, width: 420, fontSize: 48, fill: '#111827' })
  else if (kind === 'rect') object = new Rect({ left: 120, top: 120, width: 220, height: 140, fill: '#111827' })
  else if (kind === 'circle') object = new Circle({ left: 120, top: 120, radius: 90, fill: '#111827' })
  else if (kind === 'ellipse') object = new Ellipse({ left: 120, top: 120, rx: 110, ry: 70, fill: '#111827' })
  else if (kind === 'triangle') object = new Triangle({ left: 120, top: 120, width: 180, height: 160, fill: '#111827' })
  else if (kind === 'line') object = new Line([120, 120, 360, 120], { stroke: '#111827', strokeWidth: 6 })
  else if (kind === 'polygon') object = new Polygon([{ x: 120, y: 120 }, { x: 220, y: 80 }, { x: 320, y: 160 }, { x: 220, y: 220 }], { fill: '#111827' })
  else object = new Polyline([{ x: 120, y: 200 }, { x: 180, y: 120 }, { x: 240, y: 200 }, { x: 300, y: 120 }], { fill: '', stroke: '#111827', strokeWidth: 6 })
  object.set({ id: `layer-${kind}-${Date.now().toString(36)}`, name: kind } as never)
  canvas.add(object)
  canvas.setActiveObject(object)
  canvas.requestRenderAll()
}

function pickSvg(): void {
  svgInput.value?.click()
}

async function addSvgFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const { objects, options } = await loadSVGFromString(text)
    const valid = objects.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    if (valid.length === 0) throw new Error('empty svg')
    const group = util.groupSVGElements(valid, options)
    group.set({ left: 140, top: 140, id: `svg-${Date.now().toString(36)}`, name: file.name } as never)
    const canvas = editor.value?.fabricCanvas
    canvas?.add(group)
    canvas?.setActiveObject(group)
    canvas?.requestRenderAll()
    useToast().add({ title: t('studio.shapes.svgAdded'), description: file.name, color: 'success', icon: 'i-lucide-file-image' })
  } catch {
    useToast().add({ title: t('studio.shapes.svgFailed'), color: 'error', icon: 'i-lucide-x-circle' })
  }
  if (svgInput.value) svgInput.value.value = ''
}
const iconResults = ref<string[]>([])
const iconsBusy = ref(false)

function setCategory(next: typeof SHAPE_CATEGORIES[number]): void {
  category.value = next
}

const categoryShapes = computed(() => SHAPE_CATALOG.filter(entry => entry.category === category.value))

const CATEGORY_KEYS: Record<string, string> = {
  basic: 'studio.shapes.cat.basic',
  arrows: 'studio.shapes.cat.arrows',
  lines: 'studio.shapes.cat.lines',
  frames: 'studio.shapes.cat.frames',
  badges: 'studio.shapes.cat.badges',
}

function addShape(entry: ShapeEntry): void {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  const spec = shapeInsertSpec(entry)
  if (spec.type === 'circle') {
    const circle = new Circle({ radius: Number(spec.radius ?? 60), fill: entry.fill, left: spec.left, top: spec.top })
    canvas.add(circle)
    canvas.setActiveObject(circle)
  } else if (spec.type === 'triangle') {
    const triangle = new Triangle({ width: 140, height: 140, fill: entry.fill, left: spec.left, top: spec.top })
    canvas.add(triangle)
    canvas.setActiveObject(triangle)
  } else if (spec.type === 'rect') {
    const rect = new Rect({ width: 160, height: 120, fill: entry.fill, left: spec.left, top: spec.top })
    canvas.add(rect)
    canvas.setActiveObject(rect)
  } else if (typeof spec.path === 'string') {
    const path = new Path(spec.path, { fill: entry.fill, left: spec.left, top: spec.top })
    path.set({ name: entry.name, strokeUniform: true })
    canvas.add(path)
    canvas.setActiveObject(path)
  }
  canvas.requestRenderAll()
}

async function addQrCode(): Promise<void> {
  const value = qrData.value.trim()
  if (!value) return
  qrBusy.value = true
  const plugin = editor.value?.getPlugin?.('qrcode') as { addQrCode?: (data: string, size?: number) => Promise<boolean> } | undefined
  try {
    const ok = await plugin?.addQrCode?.(value, 320)
    if (ok) useToast().add({ title: t('studio.shapes.qrAdded'), color: 'success', icon: 'i-lucide-qr-code' })
    else useToast().add({ title: t('studio.shapes.qrFailed'), color: 'error', icon: 'i-lucide-x-circle' })
  } catch {
    useToast().add({ title: t('studio.shapes.qrFailed'), color: 'error', icon: 'i-lucide-x-circle' })
  }
  qrBusy.value = false
}

async function searchIcons(): Promise<void> {
  const query = iconQuery.value.trim()
  if (!query) return
  iconsBusy.value = true
  try {
    const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=36`)
    const payload = await response.json() as { icons?: string[] }
    iconResults.value = payload.icons ?? []
  } catch {
    iconResults.value = []
    useToast().add({ title: t('studio.shapes.iconSearchFailed'), color: 'error', icon: 'i-lucide-cloud-off' })
  }
  iconsBusy.value = false
}

async function addIcon(icon: string): Promise<void> {
  const canvas = editor.value?.fabricCanvas
  if (!canvas) return
  try {
    const response = await fetch(`https://api.iconify.design/${icon}.svg?color=%230f172a`)
    const svgText = await response.text()
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
    FabricImage.fromURL(dataUrl).then((image) => {
      image.set({ left: 100, top: 100, name: `icon ${icon}` })
      canvas.add(image)
      canvas.setActiveObject(image)
      canvas.requestRenderAll()
    })
  } catch {
    useToast().add({ title: t('studio.shapes.iconAddFailed'), color: 'error', icon: 'i-lucide-x-circle' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <section class="space-y-2">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">{{ t('studio.shapes.primitives') }}</h3>
      <div class="grid grid-cols-4 gap-1.5">
        <UButton
          v-for="primitive in PRIMITIVES" :key="primitive.id"
          variant="outline" color="neutral"
          class="aspect-square flex-col gap-1 h-auto py-2"
          :aria-label="t(primitive.label)"
          @click="addPrimitive(primitive.id)">
          <Icon :name="primitive.icon" class="size-5" />
          <span class="text-[9px] leading-none">{{ t(primitive.label) }}</span>
        </UButton>
      </div>
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" icon="lucide:upload" class="flex-1" @click="pickSvg">
          {{ t('studio.shapes.svgImport') }}
        </UButton>
        <input ref="svgInput" type="file" accept=".svg,image/svg+xml" class="hidden" @change="addSvgFile">
      </div>
      <p class="text-[10px] text-muted">{{ t('studio.shapes.svgHint') }}</p>
    </section>

    <div class="flex gap-1.5 flex-wrap">
      <UButton
        v-for="cat in SHAPE_CATEGORIES" :key="cat"
        size="xs" :variant="category === cat ? 'soft' : 'ghost'"
        :color="category === cat ? 'primary' : 'neutral'"
        @click="setCategory(cat)">
        {{ t(CATEGORY_KEYS[cat] ?? cat) }}
      </UButton>
    </div>

    <div class="grid grid-cols-4 gap-2">
      <button
        v-for="entry in categoryShapes" :key="entry.id"
        type="button" class="aspect-square rounded-lg border border-default bg-elevated/50 hover:border-primary transition-colors flex items-center justify-center p-1.5"
        :aria-label="t(entry.name)"
        @click="addShape(entry)">
        <svg viewBox="0 0 100 100" class="w-full h-full" aria-hidden="true">
          <path v-if="entry.kind === 'path'" :d="entry.path" :fill="entry.fill" fill-rule="evenodd" />
          <rect v-else-if="entry.kind === 'rect'" x="10" y="10" width="80" height="80" :fill="entry.fill" />
          <circle v-else-if="entry.kind === 'circle'" cx="50" cy="50" r="40" :fill="entry.fill" />
          <polygon v-else points="50,10 90,82 10,82" :fill="entry.fill" />
        </svg>
      </button>
    </div>

    <div class="border-t border-default pt-3 space-y-2">
      <h3 class="text-[11px] font-semibold text-dimmed uppercase tracking-wider">{{ t('studio.shapes.icons') }}</h3>
      <div class="flex gap-2">
        <UInput v-model="iconQuery" size="xs" :placeholder="t('studio.shapes.iconPlaceholder')" class="flex-1" @keydown.enter="searchIcons" />
        <UButton size="xs" variant="soft" icon="lucide:search" :loading="iconsBusy" @click="searchIcons">
          {{ t('common.search') }}
        </UButton>
      </div>
      <div class="flex gap-2">
        <UInput v-model="qrData" size="xs" :placeholder="t('studio.shapes.qrPlaceholder')" class="flex-1" @keydown.enter="addQrCode" />
        <UButton size="xs" variant="soft" icon="lucide:qr-code" :loading="qrBusy" @click="addQrCode">
          {{ t('studio.shapes.qrAdd') }}
        </UButton>
      </div>
      <div v-if="iconResults.length > 0" class="grid grid-cols-6 gap-1.5">
        <button
          v-for="icon in iconResults" :key="icon" type="button"
          class="aspect-square rounded-md border border-default bg-elevated flex items-center justify-center hover:border-primary transition-colors"
          :aria-label="icon"
          @click="addIcon(icon)">
          <img :src="`https://api.iconify.design/${icon}.svg?color=%23474141`" class="w-5 h-5" loading="lazy" alt="">
        </button>
      </div>
    </div>
  </div>
</template>
