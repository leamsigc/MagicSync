<i18n src="../index.json"></i18n>
<script setup lang="ts">
/**
 *
 * LayerEditorModal — Figma-grade visual editor for menu board pages.
 *
 * Composes pages from draggable layers (text, image, list, panel/badge)
 * with full CSS control: typography, fill, stroke, radius, shadow,
 * opacity, rotation, blend, blur, filters, padding, objectFit, etc.
 * Produces inline-styled HTML compatible with TVs and shared links.
 *
 */
import MediaSourcePicker from './MediaSourcePicker.vue'
import {
  LAYER_TEMPLATES,
  DEFAULT_FONT_FAMILY,
  instantiateTemplateLayers,
  type LayerTemplate,
  type TemplateLayerType,
  type ListStyle,
  type TextAlign,
  type FontWeight,
  type FillType,
  type BlendMode,
  type ObjectFit,
  type BorderStyle,
  type InstantiatedLayer,
} from '../layer-templates'
import { getDisplaySize, TV_DISPLAY_SIZES, type TvDisplaySize } from '../types'

const { t } = useI18n()

type LayerType = TemplateLayerType | 'html'

interface BoardLayer extends InstantiatedLayer {
  type: LayerType
  customCss: string
  className: string
  elementId: string
}

interface Props {
  open: boolean
  title?: string
  displaySize?: TvDisplaySize
}

const props = withDefaults(defineProps<Props>(), { title: 'New Layer Page', displaySize: 'fhd' })

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:displaySize': [size: TvDisplaySize]
  save: [name: string, html: string]
}>()

const stageW = computed(() => getDisplaySize(props.displaySize).width)
const stageH = computed(() => getDisplaySize(props.displaySize).height)
const uid = (): string => Math.random().toString(36).slice(2, 10)

const pageName = ref(props.title)
const layers = ref<BoardLayer[]>([])
const selectedId = ref<string | null>(null)
const selectedLayer = computed(() => layers.value.find(l => l.id === selectedId.value) ?? null)
const activeTab = ref<'templates' | 'layers'>('templates')
const activeCategory = ref<string>('All')
const searchQuery = ref('')
const propsAccordion = ref<'layout' | 'typography' | 'fill' | 'effects' | 'advanced'>('layout')

const activeTemplate = ref<LayerTemplate | null>(null)

// ── history (undo/redo) ──
const historyStack = ref<string[]>([])
const historyIndex = ref(-1)
function pushHistory(): void {
  const snap = JSON.stringify(layers.value)
  if (historyStack.value[historyIndex.value] === snap) return
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  historyStack.value.push(snap)
  historyIndex.value = historyStack.value.length - 1
  if (historyStack.value.length > 60) {
    historyStack.value.shift()
    historyIndex.value -= 1
  }
}
function undo(): void {
  if (historyIndex.value <= 0) return
  historyIndex.value -= 1
  layers.value = JSON.parse(historyStack.value[historyIndex.value] ?? '[]')
}
function redo(): void {
  if (historyIndex.value >= historyStack.value.length - 1) return
  historyIndex.value += 1
  layers.value = JSON.parse(historyStack.value[historyIndex.value] ?? '[]')
}
watch(layers, () => { /* history is pushed explicitly on user actions */ }, { deep: true })

const categories = computed(() => ['All', ...Array.from(new Set(LAYER_TEMPLATES.map(t => t.category ?? 'Other')))])
const filteredTemplates = computed(() => {
  let list = LAYER_TEMPLATES
  if (activeCategory.value !== 'All') list = list.filter(tt => (tt.category ?? 'Other') === activeCategory.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(tt => tt.name.toLowerCase().includes(q) || tt.description?.toLowerCase().includes(q))
  }
  return list
})

function applyTemplate(template: LayerTemplate): void {
  activeTemplate.value = template
  layers.value = instantiateTemplateLayers(template, stageW.value, stageH.value)
    .map(l => ({ ...l, type: l.type as LayerType, customCss: '', className: '', elementId: '' } as BoardLayer))
  pageName.value = template.name
  selectedId.value = layers.value[0]?.id ?? null
  activeTab.value = 'layers'
  propsAccordion.value = 'layout'
  pushHistory()
}

function reflowToStage(newW: number, newH: number): void {
  if (!activeTemplate.value) return
  layers.value = instantiateTemplateLayers(activeTemplate.value, newW, newH)
    .map(l => ({ ...l, type: l.type as LayerType, customCss: '', className: '', elementId: '' } as BoardLayer))
  selectedId.value = null
  pushHistory()
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    pageName.value = props.title
    layers.value = []
    selectedId.value = null
    activeTemplate.value = null
    activeTab.value = 'templates'
    searchQuery.value = ''
    activeCategory.value = 'All'
    historyStack.value = []
    historyIndex.value = -1
    pushHistory()
  }
})

watch([stageW, stageH], ([w, h]) => {
  if (activeTemplate.value && layers.value.length > 0) {
    reflowToStage(w, h)
    return
  }
  for (const l of layers.value) {
    l.width = Math.min(l.width, w)
    l.height = Math.min(l.height, h)
    l.x = Math.max(0, Math.min(l.x, w - l.width))
    l.y = Math.max(0, Math.min(l.y, h - l.height))
  }
})

function makeLayer(type: LayerType): BoardLayer {
  const base = {
    id: uid(),
    type,
    x: Math.round(stageW.value * 0.1),
    y: Math.round(stageH.value * 0.3),
    visible: true,
    locked: false,
    opacity: 1,
    rotation: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    borderStyle: 'solid' as BorderStyle,
    borderRadius: type === 'panel' ? 16 : 0,
    boxShadow: '',
    textShadow: '',
    backdropBlur: 0,
    filter: '',
    blendMode: 'normal' as BlendMode,
    padding: 0,
    objectFit: 'cover' as ObjectFit,
    objectPosition: 'center',
    fillType: 'solid' as FillType,
    gradient: '',
    fontWeight: 700 as FontWeight,
    fontStyle: 'normal' as const,
    textAlign: 'left' as TextAlign,
    lineHeight: 1.15,
    letterSpacing: 0,
    textTransform: 'none' as const,
    textDecoration: 'none' as const,
    customCss: '',
    className: '',
    elementId: '',
  }
  if (type === 'text') return { ...base, name: 'Heading', width: 900, height: 120, content: 'Today’s Menu', fontFamily: DEFAULT_FONT_FAMILY, src: '', items: [], fontSize: 96, color: '#ffffff', fill: 'transparent', textColor: '#ffffff', listStyle: 'dots' as ListStyle }
  if (type === 'image') return { ...base, name: 'Image', width: 640, height: 480, content: '', src: 'https://picsum.photos/seed/new-image/640/480', items: [], fontSize: 32, color: '#ffffff', fill: 'transparent', textColor: '#ffffff', listStyle: 'dots' as ListStyle, fontFamily: DEFAULT_FONT_FAMILY }
  if (type === 'list') return { ...base, name: 'Menu List', width: 800, height: 520, content: '', src: '', items: ['Margherita — $12', 'Diavola — $14 · spicy salami', 'Quattro Formaggi — $15'], fontSize: 42, color: 'rgba(0,0,0,0.22)', fill: 'transparent', listStyle: 'leader' as ListStyle, textColor: '#111827', fontFamily: DEFAULT_FONT_FAMILY, lineHeight: 1.6, fontWeight: 500 as FontWeight }
  return { ...base, name: 'Panel', width: 700, height: 520, content: '', src: '', items: [], fontSize: 32, color: '#ffffff', fill: '#1e293b', textColor: '#ffffff', listStyle: 'dots' as ListStyle, fontFamily: DEFAULT_FONT_FAMILY }
}

function addLayer(type: LayerType): void {
  const layer = makeLayer(type)
  layers.value.push(layer)
  selectedId.value = layer.id
  pushHistory()
}

function cloneLayer(id: string): void {
  const src = layers.value.find(l => l.id === id)
  if (!src) return
  const copy: BoardLayer = { ...JSON.parse(JSON.stringify(src)), id: uid(), name: `${src.name} Copy`, x: Math.min(src.x + 24, stageW.value - src.width), y: Math.min(src.y + 24, stageH.value - src.height) }
  layers.value.push(copy)
  selectedId.value = copy.id
  pushHistory()
}

function removeLayer(id: string): void {
  layers.value = layers.value.filter(l => l.id !== id)
  if (selectedId.value === id) selectedId.value = layers.value[0]?.id ?? null
  pushHistory()
}

function moveLayer(id: string, dir: -1 | 1): void {
  const index = layers.value.findIndex(l => l.id === id)
  const target = index + dir
  if (index < 0 || target < 0 || target >= layers.value.length) return
  const [layer] = layers.value.splice(index, 1)
  if (layer) layers.value.splice(target, 0, layer)
  pushHistory()
}

function toggleVisible(id: string): void {
  const l = layers.value.find(x => x.id === id)
  if (l) { l.visible = !l.visible; pushHistory() }
}
function toggleLocked(id: string): void {
  const l = layers.value.find(x => x.id === id)
  if (l) { l.locked = !l.locked }
}

function alignLayer(how: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
  const l = selectedLayer.value
  if (!l) return
  if (how === 'left') l.x = 0
  if (how === 'center') l.x = Math.round((stageW.value - l.width) / 2)
  if (how === 'right') l.x = stageW.value - l.width
  if (how === 'top') l.y = 0
  if (how === 'middle') l.y = Math.round((stageH.value - l.height) / 2)
  if (how === 'bottom') l.y = stageH.value - l.height
  pushHistory()
}

// ── canvas interactions ──
let dragging: { id: string, startX: number, startY: number, origX: number, origY: number, kind: 'move' | 'resize', handle?: string, origW?: number, origH?: number } | null = null
let rotating: { id: string, startAngle: number, origRotation: number, cx: number, cy: number } | null = null
const stageEl = ref<HTMLElement | null>(null)

function onPointerDown(event: PointerEvent, layer: BoardLayer): void {
  if (layer.locked) return
  selectedId.value = layer.id
  dragging = { id: layer.id, startX: event.clientX, startY: event.clientY, origX: layer.x, origY: layer.y, kind: 'move' }
    ; (event.target as HTMLElement).setPointerCapture?.(event.pointerId)
}

function onResizePointerDown(event: PointerEvent, layer: BoardLayer, handle: string): void {
  event.stopPropagation()
  selectedId.value = layer.id
  dragging = { id: layer.id, startX: event.clientX, startY: event.clientY, origX: layer.x, origY: layer.y, kind: 'resize', handle, origW: layer.width, origH: layer.height }
    ; (event.target as HTMLElement).setPointerCapture?.(event.pointerId)
}

function onRotatePointerDown(event: PointerEvent, layer: BoardLayer): void {
  event.stopPropagation()
  selectedId.value = layer.id
  if (!stageEl.value) return
  const rect = stageEl.value.getBoundingClientRect()
  const scale = rect.width / stageW.value || 1
  const cx = (layer.x + layer.width / 2) * scale + rect.left
  const cy = (layer.y + layer.height / 2) * scale + rect.top
  const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI
  rotating = { id: layer.id, startAngle, origRotation: layer.rotation, cx, cy }
    ; (event.target as HTMLElement).setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (rotating && stageEl.value) {
    const layer = layers.value.find(l => l.id === rotating!.id)
    if (!layer) return
    const angle = Math.atan2(event.clientY - rotating.cy, event.clientX - rotating.cx) * 180 / Math.PI
    let delta = angle - rotating.startAngle
    // snap to 15deg
    if (event.shiftKey) delta = Math.round(delta / 15) * 15
    layer.rotation = Math.round((rotating.origRotation + delta) % 360)
    return
  }
  if (!dragging || !stageEl.value) return
  const rect = stageEl.value.getBoundingClientRect()
  const scale = rect.width / stageW.value || 1
  const layer = layers.value.find(l => l.id === dragging!.id)
  if (!layer || layer.locked) return
  const dx = (event.clientX - dragging.startX) / scale
  const dy = (event.clientY - dragging.startY) / scale
  if (dragging.kind === 'move') {
    let nx = Math.round(dragging.origX + dx)
    let ny = Math.round(dragging.origY + dy)
    // snap to center / edges
    const snap = 8
    if (Math.abs(nx - (stageW.value - layer.width) / 2) < snap) nx = Math.round((stageW.value - layer.width) / 2)
    if (Math.abs(ny - (stageH.value - layer.height) / 2) < snap) ny = Math.round((stageH.value - layer.height) / 2)
    if (Math.abs(nx) < snap) nx = 0
    if (Math.abs(ny) < snap) ny = 0
    if (Math.abs(nx + layer.width - stageW.value) < snap) nx = stageW.value - layer.width
    if (Math.abs(ny + layer.height - stageH.value) < snap) ny = stageH.value - layer.height
    layer.x = Math.max(0, Math.min(stageW.value - layer.width, nx))
    layer.y = Math.max(0, Math.min(stageH.value - layer.height, ny))
  } else if (dragging.kind === 'resize') {
    const handle = dragging.handle ?? 'se'
    let nw = dragging.origW ?? layer.width
    let nh = dragging.origH ?? layer.height
    let nx = dragging.origX
    let ny = dragging.origY
    if (handle.includes('e')) nw = Math.max(24, Math.round((dragging.origW ?? 0) + dx))
    if (handle.includes('s')) nh = Math.max(24, Math.round((dragging.origH ?? 0) + dy))
    if (handle.includes('w')) { nw = Math.max(24, Math.round((dragging.origW ?? 0) - dx)); nx = Math.round(dragging.origX + dx) }
    if (handle.includes('n')) { nh = Math.max(24, Math.round((dragging.origH ?? 0) - dy)); ny = Math.round(dragging.origY + dy) }
    // constrain to stage
    if (nx < 0) { nw += nx; nx = 0 }
    if (ny < 0) { nh += ny; ny = 0 }
    if (nx + nw > stageW.value) nw = stageW.value - nx
    if (ny + nh > stageH.value) nh = stageH.value - ny
    layer.x = nx
    layer.y = ny
    layer.width = nw
    layer.height = nh
  }
}

function onPointerUp(): void {
  if (dragging || rotating) pushHistory()
  dragging = null
  rotating = null
}

function onKeyDown(e: KeyboardEvent): void {
  const l = selectedLayer.value
  if (!l || l.locked) return
  if (e.key === 'Delete' || e.key === 'Backspace') { if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return; removeLayer(l.id); e.preventDefault(); }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowUp') l.y = Math.max(0, l.y - step)
    if (e.key === 'ArrowDown') l.y = Math.min(stageH.value - l.height, l.y + step)
    if (e.key === 'ArrowLeft') l.x = Math.max(0, l.x - step)
    if (e.key === 'ArrowRight') l.x = Math.min(stageW.value - l.width, l.x + step)
    e.preventDefault(); pushHistory()
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { cloneLayer(l.id); e.preventDefault() }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { undo(); e.preventDefault() }
  if ((e.metaKey || e.ctrlKey) && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) { redo(); e.preventDefault() }
}

// ---------- inline-style HTML generation ----------

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fontFamilyCss(value: string): string {
  return value && value !== DEFAULT_FONT_FAMILY ? `font-family:${value}` : ''
}

function layerStyle(l: BoardLayer): string {
  const bg = l.fillType === 'gradient' && l.gradient ? l.gradient : (l.fill !== 'transparent' ? l.fill : '')
  const bgCss = !bg ? '' : l.fillType === 'gradient' ? `background:${bg}` : `background-color:${bg}`
  const radius = l.borderRadius ? `border-radius:${l.borderRadius}px` : ''
  const border = l.borderWidth > 0 && l.borderColor !== 'transparent' ? `border:${l.borderWidth}px ${l.borderStyle} ${l.borderColor}` : ''
  const shadow = l.boxShadow ? `box-shadow:${l.boxShadow}` : ''
  const opacity = l.opacity !== 1 ? `opacity:${l.opacity}` : ''
  const rotate = l.rotation ? `transform:rotate(${l.rotation}deg)` : ''
  const blend = l.blendMode !== 'normal' ? `mix-blend-mode:${l.blendMode}` : ''
  const backdrop = l.backdropBlur ? `backdrop-filter:blur(${l.backdropBlur}px)` : ''
  const flt = l.filter ? `filter:${l.filter}` : ''
  const pad = l.padding ? `padding:${l.padding}px` : ''
  return [
    `position:absolute`,
    `left:${l.x}px`,
    `top:${l.y}px`,
    `width:${l.width}px`,
    `height:${l.height}px`,
    bgCss,
    radius,
    border,
    shadow,
    opacity,
    rotate ? `${rotate};transform-origin:center` : '',
    blend,
    backdrop,
    flt,
    pad,
    l.type === 'text' ? [
      `font-size:${l.fontSize}px`,
      `font-weight:${l.fontWeight}`,
      l.fontStyle === 'italic' ? 'font-style:italic' : '',
      `color:${l.textColor || l.color}`,
      fontFamilyCss(l.fontFamily) || 'font-family:system-ui,sans-serif',
      `line-height:${l.lineHeight}`,
      l.letterSpacing ? `letter-spacing:${l.letterSpacing}px` : '',
      l.textTransform !== 'none' ? `text-transform:${l.textTransform}` : '',
      l.textDecoration !== 'none' ? `text-decoration:${l.textDecoration}` : '',
      l.textShadow ? `text-shadow:${l.textShadow}` : '',
      `text-align:${l.textAlign}`,
      `overflow:hidden`,
    ].filter(Boolean).join(';') : '',
    l.type === 'list' ? [
      `font-size:${l.fontSize}px`,
      `color:${l.textColor || l.color}`,
      fontFamilyCss(l.fontFamily) || 'font-family:system-ui,sans-serif',
      `line-height:${l.lineHeight}`,
      l.letterSpacing ? `letter-spacing:${l.letterSpacing}px` : '',
      l.textTransform !== 'none' ? `text-transform:${l.textTransform}` : '',
      l.textShadow ? `text-shadow:${l.textShadow}` : '',
      `text-align:${l.textAlign}`,
    ].filter(Boolean).join(';') : '',
    l.type === 'panel' ? (l.textShadow ? `text-shadow:${l.textShadow}` : '') : '',
    l.customCss.trim() ? l.customCss.trim().replace(/;+$/, '') : '',
  ].filter(Boolean).join(';')
}

function layerHtml(l: BoardLayer): string {
  if (!l.visible) return ''
  if (l.type === 'html') return l.content
  if (l.type === 'image') {
    const extra = `object-fit:${l.objectFit};object-position:${l.objectPosition}${l.filter ? `;filter:${l.filter}` : ''}${l.opacity !== 1 ? `;opacity:${l.opacity}` : ''}`
    return `<img${layerAttrs(l)} src="${esc(l.src)}" alt="${esc(l.name)}" style="${layerStyle({ ...l, fill: 'transparent', filter: '' })};${extra}" />`
  }
  if (l.type === 'list') {
    const dot = Math.round(l.fontSize * 0.35)
    const gap = Math.round(l.fontSize * 0.45)
    const rowGap = Math.round(l.fontSize * 0.5)
    const items = l.items.filter(i => i.trim()).map((raw) => {
      const [rawName, rawPrice] = raw.split('|')
      const name = esc(rawName.trim())
      const price = rawPrice ? esc(rawPrice.trim()) : ''
      const numbered = l.listStyle === 'numbered'
      // leader / dashes with dotted/dashed line, plain, dots, numbered
      if (l.listStyle === 'leader' || l.listStyle === 'dashes') {
        const sep = l.listStyle === 'leader' ? 'dotted' : 'dashed'
        return `<li style="margin-bottom:${rowGap}px;display:flex;align-items:baseline;gap:${Math.round(l.fontSize * 0.25)}px"><span style="font-weight:${l.fontWeight}">${name}</span>${price ? `<span style="flex:1;border-bottom:2px ${sep} ${l.color};margin:0 ${Math.round(l.fontSize * 0.35)}px;opacity:0.6"></span><span style="font-weight:800">${price}</span>` : ''}</li>`
      }
      if (l.listStyle === 'plain' || l.listStyle === 'numbered') {
        return `<li style="margin-bottom:${rowGap}px;display:flex;justify-content:space-between;gap:12px"><span style="font-weight:${l.fontWeight}">${numbered ? '' : ''}${name}</span>${price ? `<span style="font-weight:800;white-space:nowrap">${price}</span>` : ''}</li>`
      }
      return `<li style="margin-bottom:${rowGap}px;display:flex;align-items:center"><span style="display:inline-block;width:${dot}px;height:${dot}px;border-radius:9999px;background-color:${l.color};margin-right:${gap}px;flex-shrink:0"></span><span style="font-weight:${l.fontWeight}">${name}</span>${price ? `<span style="margin-left:auto;font-weight:800">${price}</span>` : ''}</li>`
    })
    // numbered handling: wrap in ol if needed
    if (l.listStyle === 'numbered') {
      return `<ol${layerAttrs(l)} style="${layerStyle(l)};list-style:decimal inside;margin:0;padding:0">${items.join('')}</ol>`
    }
    return `<ul${layerAttrs(l)} style="${layerStyle(l)};list-style:none;margin:0;padding:0">${items.join('')}</ul>`
  }
  if (l.type === 'text') {
    return `<div${layerAttrs(l)} style="${layerStyle(l)}">${esc(l.content).replace(/\n/g, '<br/>')}</div>`
  }
  // panel / badge / shape
  return `<div${layerAttrs(l)} style="${layerStyle(l)}"></div>`
}

function layerAttrs(l: BoardLayer): string {
  let attrs = ''
  if (l.className.trim()) attrs += ` class="${esc(l.className.trim())}"`
  if (l.elementId.trim()) attrs += ` id="${esc(l.elementId.trim())}"`
  return attrs
}
const generatedHtml = computed(() => {
  const bg = activeTemplate.value?.background ?? '#000000'
  return `<div style="position:relative;width:${stageW.value}px;height:${stageH.value}px;background:${bg};overflow:hidden">${layers.value.map(layerHtml).join('')}</div>`
})

const previewScale = computed(() => Math.min(760 / stageW.value, 520 / stageH.value))

const previewCustomCss = computed(() =>
  layers.value
    .filter(l => l.customCss.trim())
    .map(l => `[data-lid="${l.id}"]{${l.customCss.trim().replace(/;+$/, '')}}`)
    .join('\n'),
)

// ── design tokens ──
const FONT_OPTIONS = [
  { label: 'System Sans', value: 'system-ui, sans-serif' },
  { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', Didot, Georgia, serif" },
  { label: 'Montserrat', value: "'Montserrat', Verdana, sans-serif" },
  { label: 'Oswald', value: "'Oswald', 'Helvetica Neue', sans-serif" },
  { label: 'Bebas Neue', value: "'Bebas Neue', Impact, sans-serif" },
  { label: 'Dancing Script', value: "'Dancing Script', cursive" },
  { label: 'Georgia Elegant', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Trebuchet', value: "'Trebuchet MS', Verdana, sans-serif" },
  { label: 'Courier Mono', value: "'Courier New', monospace" },
  { label: 'Poppins', value: "'Poppins', sans-serif" },
]
const WEIGHT_OPTIONS = [
  { label: 'Light 300', value: 300 }, { label: 'Regular 400', value: 400 }, { label: 'Medium 500', value: 500 },
  { label: 'Semibold 600', value: 600 }, { label: 'Bold 700', value: 700 }, { label: 'Extrabold 800', value: 800 }, { label: 'Black 900', value: 900 },
]
const TEXT_ALIGN_OPTIONS = [
  { label: 'Left', value: 'left', icon: 'i-lucide-align-left' }, { label: 'Center', value: 'center', icon: 'i-lucide-align-center' }, { label: 'Right', value: 'right', icon: 'i-lucide-align-right' }, { label: 'Justify', value: 'justify', icon: 'i-lucide-align-justify' },
]
const BLEND_OPTIONS = [
  { label: 'Normal', value: 'normal' }, { label: 'Multiply', value: 'multiply' }, { label: 'Screen', value: 'screen' }, { label: 'Overlay', value: 'overlay' }, { label: 'Soft Light', value: 'soft-light' },
]
const OBJECT_FIT_OPTIONS = [
  { label: 'Cover', value: 'cover' }, { label: 'Contain', value: 'contain' }, { label: 'Fill', value: 'fill' }, { label: 'None', value: 'none' },
]
const BORDER_STYLE_OPTIONS = [
  { label: 'Solid', value: 'solid' }, { label: 'Dashed', value: 'dashed' }, { label: 'Dotted', value: 'dotted' }, { label: 'Double', value: 'double' },
]

function listRows(layer: BoardLayer): { name: string, price: string }[] {
  return layer.items.filter(i => i.trim()).map((raw) => {
    const [name, price] = raw.split('|')
    return { name: (name ?? '').trim(), price: price?.trim() ?? '' }
  })
}

function save(): void {
  emit('save', pageName.value.trim() || 'Layer Page', generatedHtml.value)
  emit('update:open', false)
}
</script>

<template>
  <div>
    <UModal :open="open" @update:open="emit('update:open', $event)" fullscreen>
      <template #content>
        <div class="p-4 md:p-6 space-y-4 max-h-screen overflow-hidden flex flex-col" data-testid="layer-editor-modal"
          tabindex="0" @keydown="onKeyDown">
          <!-- Header -->
          <div class="flex justify-between items-center shrink-0">
            <div class="flex items-center gap-3">
              <div class="size-9 rounded-xl bg-primary grid place-items-center text-primary-foreground">
                <UIcon name="i-lucide-layers" class="size-5" />
              </div>
              <div>
                <h2 class="text-lg font-semibold tracking-tight leading-none">{{ t('layer_editor_title') }}</h2>
                <p class="text-xs text-muted-foreground hidden md:block">Figma-style · Drag, resize, rotate · {{
                  layers.length }} layers</p>
              </div>
              <UBadge color="warning" variant="subtle" icon="i-lucide-sparkles" data-testid="layer-editor-pro-badge">Pro
              </UBadge>
            </div>
            <div class="flex items-center gap-2">
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-undo-2" :disabled="historyIndex <= 0"
                @click="undo" />
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-redo-2"
                :disabled="historyIndex >= historyStack.length - 1" @click="redo" />
              <UFormField :label="t('tv_size')" size="xs" class="hidden md:block">
                <USelect :model-value="displaySize"
                  :items="TV_DISPLAY_SIZES.map(s => ({ label: s.label, value: s.key }))" class="w-48"
                  data-testid="layer-editor-display-size"
                  @update:model-value="v => emit('update:displaySize', String(v) as TvDisplaySize)" />
              </UFormField>
              <UButton variant="ghost" color="neutral" icon="i-lucide-x"
                @click="() => { emit('update:open', false) }" />
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UInput v-model="pageName" placeholder="Page name" class="max-w-xs" size="sm"
              data-testid="layer-editor-name" />
            <div class="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hidden lg:flex">
              <span class="hidden xl:inline">Press</span> <kbd
                class="px-1.5 py-0.5 rounded bg-muted border text-[10px]">⌘ D</kbd> duplicate
              <kbd class="px-1.5 py-0.5 rounded bg-muted border text-[10px]">⌘ Z</kbd> undo
              <kbd class="px-1.5 py-0.5 rounded bg-muted border text-[10px]">→</kbd> nudge
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-4 flex-1 min-h-0">
            <!-- Left: Templates / Layers -->
            <div class="flex flex-col gap-3 min-h-0">
              <UTabs v-model="activeTab" color="neutral" size="sm" :items="[
                { label: t('templates'), value: 'templates', icon: 'i-lucide-layout-template' },
                { label: t('layers_tab'), value: 'layers', icon: 'i-lucide-layers' },
              ]" />

              <div v-if="activeTab === 'templates'" class="space-y-3 flex-1 flex flex-col min-h-0">
                <UInput v-model="searchQuery" placeholder="Search menus…" icon="i-lucide-search" size="sm" />
                <div class="flex flex-wrap gap-1">
                  <button v-for="cat in categories" :key="cat"
                    class="px-2.5 py-1 rounded-full text-xs border transition-colors"
                    :class="cat === activeCategory ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-accent border-border'"
                    @click="() => { activeCategory = cat }">{{ cat }}</button>
                </div>
                <div class="grid grid-cols-1 gap-3 overflow-y-auto pr-1 flex-1" data-testid="layer-editor-templates">
                  <button v-for="template in filteredTemplates" :key="template.id" type="button"
                    class="rounded-xl overflow-hidden ring-1 ring-border hover:ring-primary hover:shadow-lg transition-all cursor-pointer text-left group bg-card min-h-48"
                    :data-testid="`layer-template-${template.id}`" @click="() => applyTemplate(template)">
                    <div class="relative w-full aspect-16/10 overflow-hidden pointer-events-none bg-muted"
                      :style="{ background: (template as any).gradient ?? template.background }">
                      <!-- subtle picsum backdrop for templates with images -->
                      <div v-if="template.layers.some(l => l.type === 'image')" class="absolute inset-0 opacity-30"
                        :style="{ backgroundImage: `url('https://picsum.photos/seed/${template.id}-thumb/400/250')`, backgroundSize: 'cover', backgroundPosition: 'center' }" />
                      <div v-if="template.layers.some(l => l.type === 'image')"
                        class="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
                      <div v-for="(layer, li) in template.layers" :key="li" class="absolute overflow-hidden" :style="{
                        left: `${layer.x * 100}%`,
                        top: `${layer.y * 100}%`,
                        width: `${layer.w * 100}%`,
                        height: `${layer.h * 100}%`,
                        background: layer.type === 'panel' ? (layer.fill && layer.fill !== 'transparent' ? layer.fill : layer.gradient ?? 'rgba(128,128,128,0.14)') : layer.type === 'image' ? 'transparent' : 'transparent',
                        backgroundImage: layer.type === 'panel' && layer.fillType === 'gradient' && layer.gradient ? layer.gradient : undefined,
                        borderRadius: layer.borderRadius ? `${Math.min(layer.borderRadius, 12)}px` : layer.type === 'panel' ? '6px' : undefined,
                        opacity: layer.opacity ?? 1,
                        border: layer.type === 'panel' && (!layer.fill || layer.fill === 'transparent') && !layer.gradient ? '1.5px dashed rgba(128,128,128,0.35)' : layer.borderWidth ? `${layer.borderWidth}px ${layer.borderStyle} ${layer.borderColor}` : undefined,
                        boxShadow: layer.boxShadow ? layer.boxShadow.replace(/rgba\(0,0,0,0\.\d+\)/, 'rgba(0,0,0,0.18)') : undefined,
                      }">
                        <img v-if="layer.type === 'image'"
                          :src="layer.src || `https://picsum.photos/seed/${template.id}-${li}/200/150`" alt=""
                          class="w-full h-full object-cover"
                          :style="{ borderRadius: layer.borderRadius ? `${Math.min(layer.borderRadius, 8)}px` : undefined, opacity: layer.opacity ?? 1 }"
                          loading="lazy" />
                        <span v-else-if="layer.type === 'text'"
                          class="block w-full h-full overflow-hidden leading-none whitespace-pre-line px-0.75 py-px font-sans"
                          :style="{ color: layer.color, fontWeight: (layer.fontWeight ?? 700) as any, fontSize: `${Math.max((layer.fontSizeF ?? 0.03) * 160, 9)}px`, textAlign: (layer.textAlign ?? 'left') as any, textShadow: layer.color === '#ffffff' || layer.color === WHITE ? '0 1px 4px rgba(0,0,0,0.45)' : layer.textShadow ? layer.textShadow : '0 1px 2px rgba(0,0,0,0.15)', lineHeight: String(layer.lineHeight ?? 1.1) }">
                          {{ layer.content }}
                        </span>
                        <span v-else-if="layer.type === 'list'"
                          class="block w-full h-full overflow-hidden leading-tight px-0.75 py-px font-sans"
                          :style="{ color: layer.textColor || layer.color, fontSize: `${Math.max((layer.fontSizeF ?? 0.025) * 140, 7)}px`, textAlign: (layer.textAlign ?? 'left') as any, lineHeight: String(layer.lineHeight ?? 1.4) }">
                          {{ layer.items?.slice(0, 3).join(' · ') }}
                        </span>
                      </div>
                      <!-- subtle inner border for definition -->
                      <div class="absolute inset-0 pointer-events-none ring-1 ring-black/5 rounded-[inherit]" />
                    </div>
                    <div class="px-3 py-2.5 space-y-1">
                      <div class="text-sm font-semibold leading-none">{{ template.name }}</div>
                      <div class="text-xs text-muted-foreground line-clamp-1">{{ template.description }}</div>
                      <div class="flex items-center gap-1.5">
                        <UBadge size="xs" variant="subtle" color="neutral">{{ template.category }}</UBadge><span
                          class="text-[10px] text-muted-foreground">{{ template.layers.length }} layers</span>
                      </div>
                    </div>
                  </button>
                  <p v-if="filteredTemplates.length === 0" class="text-sm text-muted-foreground text-center py-8">No
                    templates found.</p>
                </div>
              </div>

              <template v-else>
                <div class="grid grid-cols-4 gap-1.5">
                  <UButton size="xs" variant="soft" icon="i-lucide-type" data-testid="layer-add-text"
                    @click="() => addLayer('text')">Text</UButton>
                  <UButton size="xs" variant="soft" icon="i-lucide-image" data-testid="layer-add-image"
                    @click="() => addLayer('image')">Image</UButton>
                  <UButton size="xs" variant="soft" icon="i-lucide-list" data-testid="layer-add-list"
                    @click="() => addLayer('list')">Menu</UButton>
                  <UButton size="xs" variant="soft" icon="i-lucide-square" data-testid="layer-add-panel"
                    @click="() => addLayer('panel')">Panel</UButton>
                </div>
                <USeparator />
                <div class="overflow-y-auto space-y-0.5 flex-1" data-testid="layer-editor-list">
                  <div v-if="layers.length === 0" class="text-sm text-muted-foreground text-center py-6">No layers —
                    pick a template or add one.</div>
                  <button v-for="layer in [...layers].reverse()" :key="layer.id"
                    class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm group border"
                    :class="layer.id === selectedId ? 'bg-primary/10 ring-1 ring-primary/40 border-primary/30' : 'hover:bg-accent border-transparent'"
                    @click="() => { selectedId = layer.id }">
                    <UIcon
                      :name="layer.type === 'text' ? 'i-lucide-type' : layer.type === 'image' ? 'i-lucide-image' : layer.type === 'list' ? 'i-lucide-list' : layer.type === 'badge' ? 'i-lucide-badge' : 'i-lucide-square'"
                      class="size-4 shrink-0"
                      :class="layer.id === selectedId ? 'text-primary' : 'text-muted-foreground'" />
                    <span class="truncate flex-1 text-left">{{ layer.name }}</span>
                    <button class="size-6 grid place-items-center rounded hover:bg-background"
                      :class="layer.visible ? 'text-muted-foreground' : 'text-muted-foreground/40'"
                      @click.stop="() => toggleVisible(layer.id)">
                      <UIcon :name="layer.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="size-3.5" />
                    </button>
                    <button class="size-6 grid place-items-center rounded hover:bg-background"
                      :class="layer.locked ? 'text-warning' : 'text-muted-foreground'"
                      @click.stop="() => toggleLocked(layer.id)">
                      <UIcon :name="layer.locked ? 'i-lucide-lock' : 'i-lucide-unlock'" class="size-3.5" />
                    </button>
                  </button>
                </div>
                <p class="text-xs text-muted-foreground text-center">Tip: drag on canvas to move · corners to resize ·
                  top handle to rotate</p>
              </template>
            </div>

            <!-- Center: Stage -->
            <div class="flex flex-col items-center gap-3 min-h-0 overflow-hidden">
              <div class="flex items-center gap-1.5">
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-align-horizontal-justify-start"
                  @click="() => alignLayer('left')" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-align-horizontal-justify-center"
                  @click="() => alignLayer('center')" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-align-horizontal-justify-end"
                  @click="() => alignLayer('right')" />
                <div class="w-px h-4 bg-border mx-1" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-align-vertical-justify-start"
                  @click="() => alignLayer('top')" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-align-vertical-justify-center"
                  @click="() => alignLayer('middle')" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-align-vertical-justify-end"
                  @click="() => alignLayer('bottom')" />
                <div class="w-px h-4 bg-border mx-1" />
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-copy"
                  @click="() => { if (selectedLayer) cloneLayer(selectedLayer.id) }" />
                <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" :disabled="!selectedLayer"
                  @click="() => { if (selectedLayer) removeLayer(selectedLayer.id) }" />
              </div>
              <div ref="stageEl"
                class="relative bg-black origin-top-left ring-1 ring-neutral-700/60 rounded-xl overflow-hidden touch-none select-none shadow-2xl"
                :style="{ width: `${stageW * previewScale}px`, height: `${stageH * previewScale}px`, background: activeTemplate?.background ?? '#0a0a0a' }"
                data-testid="layer-editor-stage" @pointermove="onPointerMove" @pointerup="onPointerUp"
                @pointerleave="onPointerUp">
                <component :is="'style'" v-if="previewCustomCss">{{ previewCustomCss }}</component>
                <!-- stage background -->
                <div class="absolute inset-0 pointer-events-none"
                  :style="{ background: activeTemplate?.background ?? '#000' }" />
                <div v-for="layer in layers" :key="layer.id" class="absolute" :data-lid="layer.id"
                  :class="[layer.visible ? '' : 'opacity-30', layer.locked ? 'pointer-events-none' : 'cursor-move', layer.id === selectedId ? 'ring-2 ring-primary z-10' : '']"
                  :style="{
                    left: `${(layer.x / stageW) * 100}%`,
                    top: `${(layer.y / stageH) * 100}%`,
                    width: `${(layer.width / stageW) * 100}%`,
                    height: `${(layer.height / stageH) * 100}%`,
                    background: layer.type === 'image' || layer.type === 'html' ? 'transparent' : (layer.fillType === 'gradient' && layer.gradient ? layer.gradient : (layer.fill === 'transparent' ? (layer.id === selectedId ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,.06)') : layer.fill)),
                    borderRadius: layer.borderRadius ? `${layer.borderRadius * previewScale}px` : '0',
                    border: layer.borderWidth ? `${Math.max(1, layer.borderWidth * previewScale)}px ${layer.borderStyle} ${layer.borderColor}` : undefined,
                    boxShadow: layer.boxShadow ? layer.boxShadow : undefined,
                    opacity: layer.visible ? layer.opacity : 0.35,
                    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                    transformOrigin: 'center',
                    mixBlendMode: layer.blendMode as any,
                    backdropFilter: layer.backdropBlur ? `blur(${layer.backdropBlur}px)` : undefined,
                    filter: layer.filter || undefined,
                    padding: layer.padding ? `${layer.padding * previewScale}px` : undefined,
                    overflow: layer.type === 'html' ? 'hidden' : 'hidden',
                  }" @pointerdown="e => onPointerDown(e, layer)">
                  <template v-if="layer.type === 'html'">
                    <div class="absolute top-0 left-0 origin-top-left pointer-events-none"
                      :style="{ transform: `scale(${previewScale})`, width: `${stageW}px`, height: `${stageH}px` }"
                      v-html="layer.content" />
                  </template>
                  <span v-else-if="layer.type === 'text'" class="block w-full h-full overflow-hidden px-1" :style="{
                    fontSize: `${Math.max(layer.fontSize * previewScale, 7)}px`,
                    color: layer.textColor || layer.color,
                    fontWeight: layer.fontWeight as any,
                    fontStyle: layer.fontStyle as any,
                    fontFamily: (!layer.fontFamily || layer.fontFamily === DEFAULT_FONT_FAMILY) ? undefined : layer.fontFamily,
                    textAlign: layer.textAlign as any,
                    lineHeight: String(layer.lineHeight),
                    letterSpacing: layer.letterSpacing ? `${layer.letterSpacing * previewScale}px` : undefined,
                    textTransform: layer.textTransform as any,
                    textDecoration: layer.textDecoration as any,
                    textShadow: layer.textShadow || undefined,
                    whiteSpace: 'pre-line',
                  }">{{ layer.content }}</span>
                  <img v-else-if="layer.type === 'image' && layer.src" :src="layer.src" :alt="layer.name"
                    class="w-full h-full pointer-events-none"
                    :style="{ objectFit: layer.objectFit as any, objectPosition: layer.objectPosition, filter: layer.filter || undefined, borderRadius: layer.borderRadius ? `${layer.borderRadius * previewScale}px` : undefined }">
                  <ul v-else-if="layer.type === 'list'" class="w-full h-full overflow-hidden list-none m-0 p-1"
                    :style="{ textAlign: layer.textAlign as any }">
                    <li v-for="(item, i) in listRows(layer)" :key="i" class="flex"
                      :class="layer.listStyle === 'dots' ? 'items-center' : 'items-baseline gap-1'"
                      :style="{ marginBottom: `${Math.max(2, layer.fontSize * 0.18 * previewScale)}px` }">
                      <span v-if="layer.listStyle === 'dots'" class="rounded-full shrink-0"
                        :style="{ width: `${layer.fontSize * 0.32 * previewScale}px`, height: `${layer.fontSize * 0.32 * previewScale}px`, backgroundColor: layer.color, marginRight: `${layer.fontSize * 0.4 * previewScale}px` }" />
                      <span v-if="layer.listStyle === 'numbered'" class="shrink-0 font-bold mr-1"
                        :style="{ fontSize: `${Math.max(layer.fontSize * previewScale * 0.85, 7)}px`, color: layer.color }">{{
                          i + 1
                        }}.</span>
                      <span class="truncate"
                        :style="{ fontSize: `${Math.max(layer.fontSize * previewScale * 0.92, 7)}px`, color: layer.textColor || '#fff', fontFamily: (!layer.fontFamily || layer.fontFamily === DEFAULT_FONT_FAMILY) ? undefined : layer.fontFamily, fontWeight: layer.fontWeight as any, letterSpacing: layer.letterSpacing ? `${layer.letterSpacing * previewScale}px` : undefined }">{{
                          item.name }}</span>
                      <span v-if="item.price && (layer.listStyle === 'leader' || layer.listStyle === 'dashes')"
                        class="flex-1 self-center mx-1"
                        :style="{ borderBottom: `2px ${layer.listStyle === 'leader' ? 'dotted' : 'dashed'} ${layer.color}`, opacity: 0.6 }" />
                      <span v-if="item.price" class="shrink-0 font-bold ml-auto"
                        :style="{ fontSize: `${Math.max(layer.fontSize * previewScale * 0.92, 7)}px`, color: layer.textColor || '#fff', fontFamily: (!layer.fontFamily || layer.fontFamily === DEFAULT_FONT_FAMILY) ? undefined : layer.fontFamily, fontWeight: 700 }">{{
                          item.price }}</span>
                    </li>
                  </ul>
                  <!-- selection handles -->
                  <template v-if="layer.id === selectedId && !layer.locked">
                    <div
                      class="absolute -top-1.5 -left-1.5 size-2.5 bg-white border border-primary rounded-sm cursor-nw-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 'nw')" />
                    <div
                      class="absolute -top-1.5 left-1/2 -translate-x-1/2 size-2.5 bg-white border border-primary rounded-sm cursor-n-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 'n')" />
                    <div
                      class="absolute -top-1.5 -right-1.5 size-2.5 bg-white border border-primary rounded-sm cursor-ne-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 'ne')" />
                    <div
                      class="absolute top-1/2 -right-1.5 -translate-y-1/2 size-2.5 bg-white border border-primary rounded-sm cursor-e-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 'e')" />
                    <div
                      class="absolute -bottom-1.5 -right-1.5 size-2.5 bg-white border border-primary rounded-sm cursor-se-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 'se')" />
                    <div
                      class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-2.5 bg-white border border-primary rounded-sm cursor-s-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 's')" />
                    <div
                      class="absolute -bottom-1.5 -left-1.5 size-2.5 bg-white border border-primary rounded-sm cursor-sw-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 'sw')" />
                    <div
                      class="absolute top-1/2 -left-1.5 -translate-y-1/2 size-2.5 bg-white border border-primary rounded-sm cursor-w-resize shadow"
                      @pointerdown="e => onResizePointerDown(e, layer, 'w')" />
                    <!-- rotation handle -->
                    <div
                      class="absolute -top-7 left-1/2 -translate-x-1/2 size-6 rounded-full bg-white border border-primary shadow grid place-items-center cursor-grab"
                      @pointerdown="e => onRotatePointerDown(e, layer)">
                      <UIcon name="i-lucide-rotate-cw" class="size-3 text-primary" />
                    </div>
                    <div class="absolute -top-4 left-1/2 w-px h-3 bg-primary/70 -translate-x-1/2" />
                  </template>
                </div>
              </div>
              <!-- zoom & stats -->
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <UBadge variant="subtle" color="neutral" size="sm">{{ Math.round(previewScale * 100) }}%</UBadge>
                <span>{{ stageW }} × {{ stageH }}</span>
                <span>·</span>
                <span class="hidden sm:inline">{{ selectedLayer ? `${selectedLayer.name} —
                  ${Math.round(selectedLayer.width)}×${Math.round(selectedLayer.height)} @
                  ${selectedLayer.x},${selectedLayer.y}` :
                  'No selection' }}</span>
              </div>
            </div>

            <!-- Right: Properties (Figma-style) -->
            <div class="flex flex-col gap-0 min-h-0 overflow-hidden">
              <div class="flex items-center justify-between shrink-0">
                <p class="text-sm font-semibold flex items-center gap-2">
                  <UIcon name="i-lucide-sliders-horizontal" class="size-4" /> Properties
                </p>
                <UBadge v-if="selectedLayer" variant="subtle" color="neutral" size="sm" class="capitalize">{{
                  selectedLayer.type }}
                </UBadge>
              </div>
              <div class="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3 mt-3" style="max-height: 66vh;">
                <template v-if="selectedLayer">
                  <!-- Name -->
                  <UFormField label="Layer name" size="xs">
                    <UInput v-model="selectedLayer.name" size="sm" class="w-full" />
                  </UFormField>

                  <!-- Layout Section -->
                  <div class="rounded-xl border border-border overflow-hidden">
                    <button
                      class="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/60 text-sm font-medium"
                      @click="() => { propsAccordion = propsAccordion === 'layout' ? 'layout' : 'layout' }">
                      <span class="flex items-center gap-2">
                        <UIcon name="i-lucide-move" class="size-4" /> Layout
                      </span>
                      <UIcon :name="propsAccordion === 'layout' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="size-4" />
                    </button>
                    <div v-show="propsAccordion === 'layout'" class="p-3 space-y-3">
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="X" size="xs">
                          <UInput v-model.number="selectedLayer.x" type="number" size="sm" :min="0" :max="stageW" />
                        </UFormField>
                        <UFormField label="Y" size="xs">
                          <UInput v-model.number="selectedLayer.y" type="number" size="sm" :min="0" :max="stageH" />
                        </UFormField>
                        <UFormField label="W" size="xs">
                          <UInput v-model.number="selectedLayer.width" type="number" size="sm" :min="24"
                            :max="stageW" />
                        </UFormField>
                        <UFormField label="H" size="xs">
                          <UInput v-model.number="selectedLayer.height" type="number" size="sm" :min="24"
                            :max="stageH" />
                        </UFormField>
                      </div>
                      <div class="space-y-2">
                        <UFormField :label="`Rotation — ${selectedLayer.rotation}°`" size="xs">
                          <USlider :model-value="selectedLayer.rotation" :min="0" :max="360" :step="1"
                            @update:model-value="v => { if (selectedLayer) selectedLayer.rotation = Number(v) }" />
                        </UFormField>
                        <div class="flex gap-1">
                          <UInput v-model.number="selectedLayer.rotation" type="number" size="sm" class="w-20" :min="0"
                            :max="360" />
                          <UButton size="xs" variant="ghost"
                            @click="() => { if (selectedLayer) selectedLayer.rotation = 0 }">Reset</UButton>
                          <UButton size="xs" variant="soft"
                            @click="() => { if (selectedLayer) selectedLayer.rotation = (selectedLayer.rotation + 90) % 360 }">
                            +90°</UButton>
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField :label="`Opacity — ${Math.round(selectedLayer.opacity * 100)}%`" size="xs">
                          <USlider :model-value="selectedLayer.opacity" :min="0" :max="1" :step="0.05"
                            @update:model-value="v => { if (selectedLayer) selectedLayer.opacity = Number(v) }" />
                        </UFormField>
                        <UFormField :label="`Radius — ${selectedLayer.borderRadius}px`" size="xs">
                          <USlider :model-value="selectedLayer.borderRadius" :min="0" :max="64" :step="1"
                            @update:model-value="v => { if (selectedLayer) selectedLayer.borderRadius = Number(v) }" />
                        </UFormField>
                      </div>
                      <UFormField label="Padding" size="xs"
                        v-if="selectedLayer.type === 'panel' || selectedLayer.type === 'badge'">
                        <USlider :model-value="selectedLayer.padding" :min="0" :max="48" :step="2"
                          @update:model-value="v => { if (selectedLayer) selectedLayer.padding = Number(v) }" />
                      </UFormField>
                      <div class="flex gap-1 flex-wrap">
                        <span class="text-xs text-muted-foreground mr-1 self-center">Align:</span>
                        <UButton size="xs" variant="ghost" icon="i-lucide-align-horizontal-justify-start"
                          @click="() => alignLayer('left')" />
                        <UButton size="xs" variant="ghost" icon="i-lucide-align-horizontal-justify-center"
                          @click="() => alignLayer('center')" />
                        <UButton size="xs" variant="ghost" icon="i-lucide-align-horizontal-justify-end"
                          @click="() => alignLayer('right')" />
                        <UButton size="xs" variant="ghost" icon="i-lucide-align-vertical-justify-start"
                          @click="() => alignLayer('top')" />
                        <UButton size="xs" variant="ghost" icon="i-lucide-align-vertical-justify-center"
                          @click="() => alignLayer('middle')" />
                        <UButton size="xs" variant="ghost" icon="i-lucide-align-vertical-justify-end"
                          @click="() => alignLayer('bottom')" />
                      </div>
                      <div class="flex gap-2">
                        <label class="flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox"
                            :checked="selectedLayer.visible" @change="() => toggleVisible(selectedLayer!.id)"
                            class="rounded" /> Visible</label>
                        <label class="flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox"
                            :checked="selectedLayer.locked" @change="() => toggleLocked(selectedLayer!.id)"
                            class="rounded" /> Locked</label>
                      </div>
                    </div>
                  </div>

                  <!-- Typography (text/list) -->
                  <div v-if="selectedLayer.type === 'text' || selectedLayer.type === 'list'"
                    class="rounded-xl border border-border overflow-hidden">
                    <button class="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 text-sm font-medium"
                      @click="() => { propsAccordion = propsAccordion === 'typography' ? 'layout' : 'typography' }"><span
                        class="flex items-center gap-2">
                        <UIcon name="i-lucide-type" class="size-4" /> Typography
                      </span>
                      <UIcon :name="propsAccordion === 'typography' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="size-4" />
                    </button>
                    <div v-show="propsAccordion === 'typography'" class="p-3 space-y-3">
                      <UFormField v-if="selectedLayer.type === 'text'" label="Text" size="xs">
                        <UTextarea v-model="selectedLayer.content" :rows="2" size="sm" class="w-full" />
                      </UFormField>
                      <UFormField label="Font family" size="xs">
                        <USelect v-model="selectedLayer.fontFamily"
                          :items="[{ label: 'Default', value: 'system' }, ...FONT_OPTIONS]" class="w-full" />
                      </UFormField>
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Size" size="xs">
                          <UInput v-model.number="selectedLayer.fontSize" type="number" size="sm" />
                        </UFormField>
                        <UFormField label="Weight" size="xs">
                          <USelect v-model="selectedLayer.fontWeight" :items="WEIGHT_OPTIONS as any" class="w-full" />
                        </UFormField>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Line height" size="xs">
                          <UInput v-model.number="selectedLayer.lineHeight" type="number" step="0.05" size="sm" />
                        </UFormField>
                        <UFormField label="Letter spacing" size="xs">
                          <UInput v-model.number="selectedLayer.letterSpacing" type="number" step="0.5" size="sm"
                            placeholder="0" />
                        </UFormField>
                      </div>
                      <div class="flex gap-1">
                        <UButton v-for="a in TEXT_ALIGN_OPTIONS" :key="a.value"
                          :variant="selectedLayer.textAlign === a.value ? 'solid' : 'ghost'" size="xs" :icon="a.icon"
                          @click="() => { if (selectedLayer) selectedLayer.textAlign = a.value as any }" />
                        <div class="ml-auto flex gap-1">
                          <UButton :variant="selectedLayer.fontStyle === 'italic' ? 'solid' : 'ghost'" size="xs"
                            icon="i-lucide-italic"
                            @click="() => { if (selectedLayer) selectedLayer.fontStyle = selectedLayer.fontStyle === 'italic' ? 'normal' : 'italic' }" />
                          <UButton :variant="selectedLayer.textDecoration === 'underline' ? 'solid' : 'ghost'" size="xs"
                            icon="i-lucide-underline"
                            @click="() => { if (selectedLayer) selectedLayer.textDecoration = selectedLayer.textDecoration === 'underline' ? 'none' : 'underline' }" />
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Transform" size="xs">
                          <USelect v-model="selectedLayer.textTransform"
                            :items="[{ label: 'None', value: 'none' }, { label: 'UPPERCASE', value: 'uppercase' }, { label: 'Capitalize', value: 'capitalize' }, { label: 'lowercase', value: 'lowercase' }]"
                            class="w-full" />
                        </UFormField>
                        <UFormField label="Color" size="xs" class="flex flex-col"><input
                            v-model="selectedLayer.textColor" type="color" class="h-9 w-full rounded cursor-pointer" />
                        </UFormField>
                      </div>
                      <UFormField label="Text shadow" size="xs" hint="e.g. 0 2px 12px rgba(0,0,0,0.35)">
                        <UInput v-model="selectedLayer.textShadow" placeholder="0 2px 8px rgba(0,0,0,0.25)" size="sm"
                          class="w-full font-mono text-xs" />
                      </UFormField>
                    </div>
                  </div>

                  <!-- List specifics -->
                  <div v-if="selectedLayer.type === 'list'" class="rounded-xl border border-border overflow-hidden">
                    <div class="px-3 py-2.5 bg-muted/40 text-sm font-medium flex items-center gap-2">
                      <UIcon name="i-lucide-list" class="size-4" /> Menu Items
                    </div>
                    <div class="p-3 space-y-2">
                      <UFormField label="Items — use 'Name | Price · desc' (one per line)" size="xs">
                        <UTextarea :model-value="selectedLayer.items.join('\n')" :rows="6" size="sm"
                          class="w-full font-mono text-xs"
                          @update:model-value="(v: string) => { if (selectedLayer) selectedLayer.items = String(v).split('\n') }" />
                      </UFormField>
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Style" size="xs">
                          <USelect v-model="selectedLayer.listStyle"
                            :items="[{ label: '● Dots', value: 'dots' }, { label: '· · · Leader', value: 'leader' }, { label: '— Dashes', value: 'dashes' }, { label: 'Plain', value: 'plain' }, { label: '1. Numbered', value: 'numbered' }]"
                            class="w-full" />
                        </UFormField>
                        <UFormField label="Dot / line color" size="xs"><input v-model="selectedLayer.color" type="color"
                            class="h-9 w-full rounded cursor-pointer" /></UFormField>
                      </div>
                      <p class="text-xs text-muted-foreground">Tip: add “· description” after price for subtext.
                        Example: <span class="font-mono">Salmon | $14 · yuzu, herb</span></p>
                    </div>
                  </div>

                  <!-- Image -->
                  <div v-if="selectedLayer.type === 'image'" class="rounded-xl border border-border overflow-hidden">
                    <div class="px-3 py-2.5 bg-muted/40 text-sm font-medium flex items-center gap-2">
                      <UIcon name="i-lucide-image" class="size-4" /> Image
                    </div>
                    <div class="p-3 space-y-3">
                      <MediaSourcePicker v-model="selectedLayer.src" />
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Object fit" size="xs">
                          <USelect v-model="selectedLayer.objectFit" :items="OBJECT_FIT_OPTIONS as any"
                            class="w-full" />
                        </UFormField>
                        <UFormField label="Position" size="xs">
                          <UInput v-model="selectedLayer.objectPosition" placeholder="center" size="sm" />
                        </UFormField>
                      </div>
                    </div>
                  </div>

                  <!-- Fill & Stroke -->
                  <div class="rounded-xl border border-border overflow-hidden">
                    <button class="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 text-sm font-medium"
                      @click="() => { propsAccordion = propsAccordion === 'fill' ? 'layout' : 'fill' }"><span
                        class="flex items-center gap-2">
                        <UIcon name="i-lucide-palette" class="size-4" /> Fill & Stroke
                      </span>
                      <UIcon :name="propsAccordion === 'fill' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="size-4" />
                    </button>
                    <div v-show="propsAccordion === 'fill'" class="p-3 space-y-3">
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Fill type" size="xs">
                          <USelect v-model="selectedLayer.fillType"
                            :items="[{ label: 'Solid', value: 'solid' }, { label: 'Gradient', value: 'gradient' }, { label: 'Transparent', value: 'transparent' }]"
                            class="w-full" />
                        </UFormField>
                        <UFormField label="Fill" size="xs"><input v-show="selectedLayer.fillType === 'solid'"
                            v-model="selectedLayer.fill" type="color" class="h-9 w-full rounded cursor-pointer" /><span
                            v-show="selectedLayer.fillType !== 'solid'"
                            class="text-xs text-muted-foreground py-2 block">{{ selectedLayer.fillType === 'gradient' ?
                              'Use gradient below' : 'No fill' }}</span></UFormField>
                      </div>
                      <UFormField v-if="selectedLayer.fillType === 'gradient'" label="Gradient (CSS)" size="xs"
                        hint="e.g. linear-gradient(135deg, #7a1f1f, #d4a944)">
                        <UInput v-model="selectedLayer.gradient" placeholder="linear-gradient(135deg,#fdf6ec,#f5e6cf)"
                          size="sm" class="w-full font-mono text-xs" />
                      </UFormField>
                      <div class="grid grid-cols-3 gap-2">
                        <UFormField label="Border W" size="xs">
                          <UInput v-model.number="selectedLayer.borderWidth" type="number" size="sm" :min="0"
                            :max="12" />
                        </UFormField>
                        <UFormField label="Style" size="xs">
                          <USelect v-model="selectedLayer.borderStyle" :items="BORDER_STYLE_OPTIONS as any"
                            class="w-full" />
                        </UFormField>
                        <UFormField label="Color" size="xs"><input v-model="selectedLayer.borderColor" type="color"
                            class="h-9 w-full rounded cursor-pointer" /></UFormField>
                      </div>
                    </div>
                  </div>

                  <!-- Effects -->
                  <div class="rounded-xl border border-border overflow-hidden">
                    <button class="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 text-sm font-medium"
                      @click="() => { propsAccordion = propsAccordion === 'effects' ? 'layout' : 'effects' }"><span
                        class="flex items-center gap-2">
                        <UIcon name="i-lucide-sparkles" class="size-4" /> Effects
                      </span>
                      <UIcon :name="propsAccordion === 'effects' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="size-4" />
                    </button>
                    <div v-show="propsAccordion === 'effects'" class="p-3 space-y-3">
                      <UFormField label="Box shadow" size="xs" hint="e.g. 0 12px 28px rgba(0,0,0,0.22)">
                        <UInput v-model="selectedLayer.boxShadow" placeholder="0 10px 28px rgba(0,0,0,0.18)" size="sm"
                          class="w-full font-mono text-xs" />
                      </UFormField>
                      <div class="flex gap-1 flex-wrap">
                        <UButton size="xs" variant="ghost"
                          @click="() => { if (selectedLayer) selectedLayer.boxShadow = '0 4px 12px rgba(0,0,0,0.12)' }">
                          Soft</UButton>
                        <UButton size="xs" variant="ghost"
                          @click="() => { if (selectedLayer) selectedLayer.boxShadow = '0 12px 28px rgba(0,0,0,0.18)' }">
                          Medium</UButton>
                        <UButton size="xs" variant="ghost"
                          @click="() => { if (selectedLayer) selectedLayer.boxShadow = '0 20px 40px rgba(0,0,0,0.28)' }">
                          Strong</UButton>
                        <UButton size="xs" variant="ghost"
                          @click="() => { if (selectedLayer) selectedLayer.boxShadow = '' }">None</UButton>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <UFormField label="Backdrop blur" size="xs">
                          <USlider :model-value="selectedLayer.backdropBlur" :min="0" :max="24" :step="1"
                            @update:model-value="v => { if (selectedLayer) selectedLayer.backdropBlur = Number(v) }" />
                        </UFormField>
                        <UFormField label="Blend" size="xs">
                          <USelect v-model="selectedLayer.blendMode" :items="BLEND_OPTIONS as any" class="w-full" />
                        </UFormField>
                      </div>
                      <UFormField label="Filter" size="xs" hint="e.g. brightness(1.1) contrast(1.05)">
                        <UInput v-model="selectedLayer.filter" placeholder="brightness(0.95) contrast(1.1)" size="sm"
                          class="w-full font-mono text-xs" />
                      </UFormField>
                    </div>
                  </div>

                  <!-- Advanced -->
                  <div class="rounded-xl border border-border overflow-hidden">
                    <button class="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 text-sm font-medium"
                      @click="() => { propsAccordion = propsAccordion === 'advanced' ? 'layout' : 'advanced' }"><span
                        class="flex items-center gap-2">
                        <UIcon name="i-lucide-code-2" class="size-4" /> Advanced
                      </span>
                      <UIcon :name="propsAccordion === 'advanced' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="size-4" />
                    </button>
                    <div v-show="propsAccordion === 'advanced'" class="p-3 space-y-3">
                      <UFormField label="Class name(s)" size="xs">
                        <UInput v-model="selectedLayer.className" placeholder="menu-item highlight" size="sm"
                          class="w-full font-mono text-xs" />
                      </UFormField>
                      <UFormField label="Element ID" size="xs">
                        <UInput v-model="selectedLayer.elementId" placeholder="daily-special" size="sm"
                          class="w-full font-mono text-xs" />
                      </UFormField>
                      <UFormField label="Custom CSS" size="xs">
                        <UTextarea v-model="selectedLayer.customCss" :rows="3" size="sm"
                          class="w-full font-mono text-xs"
                          placeholder="letter-spacing: 2px; text-transform: uppercase;" />
                      </UFormField>
                    </div>
                  </div>

                  <div class="flex gap-1">
                    <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-up"
                      @click="() => moveLayer(selectedLayer.id, -1)" />
                    <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-down"
                      @click="() => moveLayer(selectedLayer.id, 1)" />
                    <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-copy"
                      @click="() => cloneLayer(selectedLayer.id)">Duplicate</UButton>
                    <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" class="ml-auto"
                      @click="() => removeLayer(selectedLayer.id)">Delete</UButton>
                  </div>
                </template>
                <p v-else class="text-sm text-muted-foreground py-10 text-center">Select or add a layer to edit its
                  properties.<br /><span class="text-xs">Try a template to start faster.</span></p>

                <USeparator label="Generated HTML" type="dashed" />
                <pre
                  class="text-[10px] text-muted-foreground bg-muted rounded-lg p-2 overflow-x-auto max-h-28 whitespace-pre-wrap break-all">
      {{ generatedHtml.slice(0, 1200) }}{{ generatedHtml.length > 1200 ? '…' : '' }}</pre>
              </div>
              <div class="flex gap-2 pt-3 shrink-0">
                <UButton variant="ghost" color="neutral" class="flex-1" @click="() => { emit('update:open', false) }">
                  Cancel
                </UButton>
                <UButton data-testid="layer-editor-save" :disabled="layers.length === 0" class="flex-1" @click="save">
                  Save as Page
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
