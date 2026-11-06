import {
  DOCUMENT_SCHEMA_ID,
  newPageId,
  type EditorObject,
  type EditorPage,
  type ImageEditorDocument,
  type LayerAnimation,
} from './document'
import { isFieldSuffix, V7_FILTER_TYPES, FONT_ALIASES, aliasSuffix, inferSuffixForObject } from './field-aliases'
import { AUTO_FIELD_RE } from './document'
import { objectIdOf } from './fields'

/**
 * Fabric v5.x → v7 normalizer — repairs every known Kuaitu/v5 serialization
 * quirk and wraps the result as an ImageEditorDocument@1.
 */

export interface NormalizeResult {
  document: ImageEditorDocument
  warnings: string[]
}

export interface NormalizeInput {
  json: unknown
  width?: number
  height?: number
}

export function normalizeDocument(input: NormalizeInput): NormalizeResult {
  const warnings: string[] = []
  if (!isRecord(input.json)) {
    return { document: emptyDocument(input.width, input.height), warnings: ['Source JSON is not an object'] }
  }
  const root = input.json
  let frame = extractFrame(root, warnings, input.width, input.height)
  const pageEntries = splitPageEntries(root, warnings)
  // A raw fabric export centers the workspace around (0,0) and carries the
  // canvas element size at the root; the workspace is the real design frame.
  const firstWorkspace = findWorkspace(pageEntries[0])
  if (firstWorkspace) {
    frame = {
      width: clampSize(Number(firstWorkspace.width) * Number(firstWorkspace.scaleX ?? 1), frame.width),
      height: clampSize(Number(firstWorkspace.height) * Number(firstWorkspace.scaleY ?? 1), frame.height),
      fill: typeof firstWorkspace.fill === 'string' ? firstWorkspace.fill : frame.fill,
    }
  }
  const pages = pageEntries.map((entry, index) => buildPage(entry, index, frame, warnings))
  const objects = pages.flatMap((page) => page.objects)
  const fields = buildFields(objects, warnings)
  const document: ImageEditorDocument = {
    schema: DOCUMENT_SCHEMA_ID,
    version: 1,
    frame,
    fields,
    meta: { sourceVersion: typeof root.version === 'string' ? root.version : 'unknown' },
    pages,
  }
  return { document, warnings }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function emptyDocument(width = 1242, height = 1660): ImageEditorDocument {
  return {
    schema: DOCUMENT_SCHEMA_ID,
    version: 1,
    frame: { width: clampSize(width), height: clampSize(height), fill: '#ffffff' },
    fields: [],
    meta: {},
    pages: [{ id: newPageId(0), name: 'Page 1', objects: [], animation: { layers: {} } }],
  }
}

function clampSize(value: unknown, fallback = 1242): number {
  const num = Math.round(Number(value) || fallback)
  return Math.min(8192, Math.max(10, num))
}

function extractFrame(root: Record<string, unknown>, warnings: string[], width?: number, height?: number) {
  const clip = isRecord(root.clipPath) ? root.clipPath : null
  if (!clip) warnings.push('No root clipPath/workspace found; frame falls back to canvas size')
  return {
    width: clampSize(clip?.width ?? root.width ?? width ?? 1242),
    height: clampSize(clip?.height ?? root.height ?? height ?? 1660, 1660),
    fill: typeof clip?.fill === 'string'
      ? clip.fill
      : (typeof root.background === 'string' ? root.background : '#ffffff'),
  }
}

/** v5 exports one root canvas; v7 exports `{pages:[{objects}]}`; Polotno uses `pages[].children`. */
function splitPageEntries(root: Record<string, unknown>, warnings: string[]): Record<string, unknown>[] {
  if (Array.isArray(root.pages) && root.pages.length > 0) {
    return root.pages.filter(isRecord).map(page => ({ ...page, objects: childObjects(page) }))
  }
  if (Array.isArray(root.objects) || Array.isArray(root.children)) {
    return [{ ...root, objects: childObjects(root) }]
  }
  warnings.push('Source JSON has no objects array; imported an empty page')
  return [{ objects: [] }]
}

/** Polotno stores layers in `children` with x/y; fabric uses `objects` with left/top. */
function childObjects(entry: Record<string, unknown>): unknown[] {
  const raw = Array.isArray(entry.objects)
    ? entry.objects
    : Array.isArray(entry.children) ? entry.children : []
  return raw.map(convertChild)
}

function convertChild(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const out: Record<string, unknown> = { ...raw }
  if (out.left === undefined && typeof out.x === 'number') out.left = out.x
  if (out.top === undefined && typeof out.y === 'number') out.top = out.y
  delete out.x
  delete out.y
  if (Array.isArray(out.children)) {
    out.objects = childObjects(out)
    delete out.children
  }
  return out
}

interface PageFrame {
  left: number
  top: number
  width: number
  height: number
  fill: string
}

/** Workspace rect marks the page frame (v7 raw canvas exports include it). */
function findWorkspace(entry: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!entry || !Array.isArray(entry.objects)) return null
  const found = entry.objects.find((obj) => isRecord(obj) && obj.id === 'workspace')
  return isRecord(found) ? found : null
}

function buildPage(entry: Record<string, unknown>, index: number, rootFrame: ImageEditorDocument['frame'], warnings: string[]): EditorPage {
  const clip = isRecord(entry.clipPath) ? entry.clipPath : null
  const rawObjects = Array.isArray(entry.objects) ? entry.objects : []
  const workspaceRect = rawObjects.find((obj) => isRecord(obj) && obj.id === 'workspace')

  const pageFrame: PageFrame = clip
    ? {
        left: Number(clip.left ?? 0),
        top: Number(clip.top ?? 0),
        width: clampSize(clip.width, rootFrame.width),
        height: clampSize(clip.height, rootFrame.height),
        fill: typeof clip.fill === 'string' ? clip.fill : rootFrame.fill,
      }
    : fromWorkspaceRect(isRecord(workspaceRect) ? workspaceRect : null, rootFrame, warnings)

  const objects = rawObjects
    .filter((obj) => !(isRecord(obj) && obj.id === 'workspace'))
    .map((obj) => normalizeObject(obj, warnings))
    .filter((obj): obj is EditorObject => obj !== null)

  // Re-base centered coordinates (workspace at -540) onto the page origin.
  if (pageFrame.left !== 0 || pageFrame.top !== 0) {
    for (const obj of objects) {
      obj.left = Number(obj.left ?? 0) - pageFrame.left
      obj.top = Number(obj.top ?? 0) - pageFrame.top
    }
    pageFrame.left = 0
    pageFrame.top = 0
  }

  // A full-frame `bg` rect is just the page fill; keeping it makes the layer
  // list show a phantom layer under every design.
  const fillIndex = objects.findIndex((obj) => isPageFillRect(obj, pageFrame))
  if (fillIndex >= 0) {
    const fillObject = objects[fillIndex]
    if (typeof fillObject.fill === 'string') pageFrame.fill = fillObject.fill
    objects.splice(fillIndex, 1)
    warnings.push('Full-frame bg rect folded into the page background')
  }

  const page: EditorPage = {
    id: newPageId(index),
    name: typeof entry.name === 'string' ? entry.name : `Page ${index + 1}`,
    objects,
    background: { fill: pageFrame.fill },
    clipPath: clip ? normalizeObject(clip, warnings) : rectToClip(pageFrame),
    animation: collectLayerAnimations(objects),
  }
  return syncObjectIdDefaults(page)
}

function isPageFillRect(obj: EditorObject, frame: PageFrame): boolean {
  return obj.id === 'bg'
    && obj.type === 'rect'
    && (obj.width ?? 0) >= frame.width * 0.95
    && (obj.height ?? 0) >= frame.height * 0.95
}

function fromWorkspaceRect(rect: Record<string, unknown> | null, rootFrame: ImageEditorDocument['frame'], warnings: string[]): PageFrame {
  if (!rect) return { left: 0, top: 0, width: rootFrame.width, height: rootFrame.height, fill: rootFrame.fill }
  warnings.push('Workspace rect converted to page frame and removed from object list')
  return {
    left: Number(rect.left ?? 0),
    top: Number(rect.top ?? 0),
    width: clampSize(rect.width, rootFrame.width),
    height: clampSize(rect.height, rootFrame.height),
    fill: typeof rect.fill === 'string' ? rect.fill : rootFrame.fill,
  }
}

function rectToClip(frame: PageFrame): EditorObject {
  return {
    type: 'rect',
    id: 'workspace',
    left: frame.left,
    top: frame.top,
    originX: 'left',
    originY: 'top',
    width: frame.width,
    height: frame.height,
    fill: frame.fill,
    strokeWidth: 0,
    selectable: false,
    hoverCursor: 'default',
  }
}

function syncObjectIdDefaults(page: EditorPage): EditorPage {
  for (const obj of page.objects) objectIdOf(obj)
  return page
}

export function collectLayerAnimations(objects: EditorObject[]): Record<string, LayerAnimation> {
  const layers: Record<string, LayerAnimation> = {}
  for (const obj of objects) {
    if (isRecord(obj.animation)) layers[objectIdOf(obj)] = normalizeLayerAnimation(obj.animation)
  }
  return layers
}

export function normalizeLayerAnimation(raw: Record<string, unknown>): LayerAnimation {
  const anim: LayerAnimation = {}
  const enter = subNormalizeEndpoint(raw.enter)
  if (enter) anim.enter = enter
  const exit = subNormalizeEndpoint(raw.exit)
  if (exit) anim.exit = exit
  if (isRecord(raw.loop)) {
    anim.loop = {
      type: pickLoopType(raw.loop.type),
      duration: Math.max(1, Number(raw.loop.duration) || 2000),
      easing: typeof raw.loop.easing === 'string' ? raw.loop.easing : 'linear',
    }
  }
  return anim
}

const ENTER_TYPES = ['fadeIn', 'riseUp', 'dropDown', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'wipeUp', 'pop', 'none']
const LOOP_TYPES = ['pulse', 'spin', 'bob', 'swing', 'blink', 'none']

type EndpointType = NonNullable<LayerAnimation['enter']>['type']

function subNormalizeEndpoint(raw: unknown): LayerAnimation['enter'] | null {
  if (!isRecord(raw)) return null
  return {
    type: (ENTER_TYPES.includes(String(raw.type)) ? String(raw.type) : 'none') as EndpointType,
    duration: Math.max(1, Number(raw.duration) || 600),
    delay: Math.max(0, Number(raw.delay) || 0),
    easing: typeof raw.easing === 'string' ? raw.easing : 'easeOutCubic',
  }
}

function pickLoopType(value: unknown): NonNullable<LayerAnimation['loop']>['type'] {
  const str = String(value ?? 'none')
  return (LOOP_TYPES.includes(str) ? str : 'none') as NonNullable<LayerAnimation['loop']>['type']
}

/* ------------------------------------------------------------------ */
/* per-object repairs                                                  */
/* ------------------------------------------------------------------ */

export function normalizeObject(raw: unknown, warnings: string[]): EditorObject | null {
  if (!isRecord(raw)) {
    warnings.push('Dropped a non-object entry inside objects[]')
    return null
  }
  const obj: EditorObject = { ...raw }
  normalizeObjectType(obj)
  normalizeText(obj)
  stripLegacyProps(obj)
  normalizeShadow(obj)
  normalizeFilters(obj, warnings)
  normalizeImage(obj)
  normalizeFontNames(obj)
  return obj
}

function normalizeObjectType(obj: EditorObject) {
  const type = String(obj.type ?? '').toLowerCase()
  if (type === 'textbox' || type === 'text' || type === 'itext' || type === 'i-text') obj.type = 'textbox'
  if (type === 'figure') applyFigureShape(obj)
  // Polotno SVG layers carry a data/URL `src`; fabric renders those as images.
  if (type === 'svg' && typeof obj.src === 'string' && obj.src.length > 0) obj.type = 'image'
  if (obj.type === undefined && typeof obj.text === 'string') obj.type = 'textbox'
}

const FIGURE_SHAPES: Record<string, string> = {
  rect: 'rect',
  rectangle: 'rect',
  square: 'rect',
  circle: 'circle',
  ellipse: 'circle',
  triangle: 'triangle',
  polygon: 'polygon',
  star: 'polygon',
}

function applyFigureShape(obj: EditorObject) {
  const subType = String(obj.subType ?? obj.figureType ?? 'rect').toLowerCase()
  obj.type = FIGURE_SHAPES[subType] ?? 'rect'
  if (obj.type === 'circle' && obj.radius === undefined) {
    obj.radius = Math.max(1, Number(obj.width ?? 0) / 2 || 1)
  }
}

function normalizeText(obj: EditorObject) {
  if (typeof obj.text === 'string') obj.text = obj.text.replace(/\r\n?/g, '\n')
  if (Array.isArray(obj.styles) && obj.styles.length === 0) obj.styles = {}
  if (obj.styles === undefined && typeof obj.text === 'string') obj.styles = {}
}

function stripLegacyProps(obj: EditorObject) {
  delete obj.price
  delete obj.proInfo
  delete obj.templateId
  delete obj.linkObjectLink
  if (Array.isArray(obj.linkObject)) obj.linkObject = [String(obj.linkObject[0] ?? ''), String(obj.linkObject[1] ?? '')]
}

function normalizeShadow(obj: EditorObject) {
  if (obj.shadow === '' || obj.shadow === undefined) obj.shadow = null
}

function normalizeFilters(obj: EditorObject, warnings: string[]) {
  if (!Array.isArray(obj.filters)) return
  const kept: EditorObject[] = []
  for (const filter of obj.filters) {
    if (isRecord(filter) && V7_FILTER_TYPES.has(String(filter.type))) {
      kept.push({ ...filter })
      continue
    }
    warnings.push(`Dropped unsupported filter ${String(isRecord(filter) ? filter.type : filter) ?? 'unknown'}`)
  }
  if (kept.length > 0) obj.filters = kept
  else obj.filters = []
}

const EMPTY_PIXEL_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function normalizeImage(obj: EditorObject) {
  if (String(obj.type ?? '').toLowerCase() !== 'image') return
  if (typeof obj.src === 'string' && obj.src.length > 0) {
    obj.crossOrigin = obj.src.startsWith('data:') ? null : 'anonymous'
  } else {
    obj.src = EMPTY_PIXEL_SRC
    obj.crossOrigin = null
  }
  obj.filters = Array.isArray(obj.filters) ? obj.filters : []
}

function normalizeFontNames(obj: EditorObject) {
  if (fontProperty(obj)) obj.fontFamily = normalizeFontFamily(obj.fontFamily)
  if (!isRecord(obj.styles) || Array.isArray(obj.styles)) return
  for (const line of Object.values(obj.styles)) {
    if (!isRecord(line)) continue
    for (const style of Object.values(line)) {
      if (isRecord(style) && fontProperty(style)) style.fontFamily = normalizeFontFamily(style.fontFamily)
    }
  }
}

function fontProperty(target: EditorObject): boolean {
  return typeof target.fontFamily === 'string' && target.fontFamily.length > 0
}

export function normalizeFontFamily(family: unknown): string {
  return FONT_ALIASES[String(family)] ?? String(family)
}

/* ------------------------------------------------------------------ */
/* fields from linkData + {} names                                     */
/* ------------------------------------------------------------------ */

function buildFields(objects: EditorObject[], warnings: string[]) {
  const byName = new Map<string, NonNullable<ImageEditorDocument['fields'][number]>>()
  for (const obj of objectsDeep(objects)) {
    const objectId = objectIdOf(obj)
    const linkData = obj.linkData
    if (Array.isArray(linkData) && linkData.length === 2) {
      const property = aliasSuffix(linkData[0]) ?? (isFieldSuffix(linkData[0]) ? String(linkData[0]) : null)
      const name = String(linkData[1] ?? '').trim()
      if (property && name) {
        const field = byName.get(name) ?? { name, targets: [] }
        field.targets.push({ objectId, property })
        byName.set(name, field)
        continue
      }
      warnings.push(`Ignored unresolvable linkData ${JSON.stringify(linkData)}`)
    }
    const auto = typeof obj.name === 'string' ? AUTO_FIELD_RE.exec(obj.name.trim()) : null
    if (auto) {
      const property = (auto[2] && aliasSuffix(auto[2])) || inferSuffixForObject(obj)
      const field = byName.get(auto[1]) ?? { name: auto[1], targets: [] }
      field.targets.push({ objectId, property })
      byName.set(auto[1], field)
    }
  }
  return [...byName.values()]
}

function objectsDeep(objects: EditorObject[]): EditorObject[] {
  const out: EditorObject[] = []
  for (const obj of objects) {
    out.push(obj)
    out.push(...objectsDeep(Array.isArray(obj.objects) ? (obj.objects as EditorObject[]) : []))
  }
  return out
}
