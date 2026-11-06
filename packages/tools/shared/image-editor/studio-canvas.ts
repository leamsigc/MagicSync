import { FabricObject, type Canvas } from 'fabric'
import type {
  DesignField,
  DocumentMeta,
  EditorObject,
  FieldSuffix,
  ImageEditorDocument,
  LayerAnimation,
  PageAnimation,
} from './document'
import { DOCUMENT_SCHEMA_ID } from './document'
import { syncFieldsFromObjects } from './fields'
import { SHAPE_CATALOG, type ShapeEntry } from './shapes'
import type { DynamicFieldValue } from './bind-fields'
import { dedupeObjects } from './fields'

/**
 * Browser design-studio canvas bridge — the single place that converts
 * between the fabric canvas (editing surface) and the ImageEditorDocument
 * envelope (storage/render/batch contract).
 */

export const ANIM_PROP = '__anim'

/** fabric object JSON keys we carry beside id/name for the editor round trip. */
export const OBJECT_CUSTOM_PROPS = ['id', 'name', ANIM_PROP, 'linkData', 'linkObject', 'videoUrl', 'poster'] as const

/**
 * Fabric drops unknown JSON keys unless they are declared globally. Without
 * this, ids and {field} layer names vanish on load — which silently breaks
 * variable binding, animations and {name} discovery after reopening a design.
 */
let customPropsRegistered = false
export function ensureObjectProperties(): void {
  if (customPropsRegistered) return
  const known = new Set(FabricObject.customProperties ?? [])
  for (const prop of OBJECT_CUSTOM_PROPS) known.add(prop)
  FabricObject.customProperties = [...known]
  customPropsRegistered = true
}

export function workspaceOf(canvas: Canvas): FabricObject | undefined {
  return canvas.getObjects().find(obj => (obj as { id?: string }).id === 'workspace')
}

export function workspaceSizeOf(canvas: Canvas): { width: number; height: number } {
  const ws = workspaceOf(canvas)
  return { width: Math.round(ws?.width ?? 1242), height: Math.round(ws?.height ?? 1660) }
}

/** Serialize the canvas into page-0 object JSON (workspace rect excluded). */
export function serializeCurrentPage(canvas: Canvas): EditorObject[] {
  const serialized = canvas
    .getObjects()
    .filter(obj => (obj as { id?: string }).id !== 'workspace')
    .map((obj) => {
      const json = obj.toObject(OBJECT_CUSTOM_PROPS) as unknown as EditorObject
      // Video layers are FabricImages whose element is a <video>. Persist the
      // poster as `src` so server/client batch renders show a still frame.
      if (typeof json.videoUrl === 'string' && json.videoUrl) {
        json.src = String(json.poster ?? json.src ?? '')
      }
      return json
    })
  const objects = dedupeObjects(serialized)
  // `__background` is the page photo/gradient and must stay at the bottom of
  // the stack. Older documents had it above the first content layer.
  const background = objects.find(obj => (obj as { id?: string }).id === '__background')
  return background ? [background, ...objects.filter(obj => obj !== background)] : objects
}

/* ------------------------------------------------------------------ */
/* page animation storage (live editing session)                       */
/* ------------------------------------------------------------------ */

let currentPageAnimation: PageAnimation = { layers: {} }

export function pageAnimationOf(_canvas: Canvas): PageAnimation {
  return { layers: { ...currentPageAnimation.layers }, ...(currentPageAnimation.transition ? { transition: { ...currentPageAnimation.transition } } : {}) }
}

export function setPageAnimation(spec: PageAnimation): void {
  currentPageAnimation = {
    layers: { ...spec.layers },
    ...(spec.transition ? { transition: { ...spec.transition } } : {}),
  }
}

export function objectAnimation(obj: FabricObject): LayerAnimation {
  const stored = (obj as unknown as Record<string, unknown>)[ANIM_PROP]
  return stored && typeof stored === 'object' ? stored as LayerAnimation : {}
}

export function setObjectAnimation(obj: FabricObject, spec: LayerAnimation): void {
  obj.set(ANIM_PROP, spec as never)
  const id = (obj as { id?: string }).id
  if (id) currentPageAnimation.layers[id] = spec
}

/* ------------------------------------------------------------------ */
/* build / expand envelope from the canvas                             */
/* ------------------------------------------------------------------ */

export function buildDocumentFromCanvas(
  canvas: Canvas,
  options: { frame: { width: number; height: number; fill: string }; title?: string; meta?: DocumentMeta; fields?: DesignField[]; pages?: EditorObject[][] },
): ImageEditorDocument {
  const current = serializeCurrentPage(canvas)
  const pageObjects = options.pages && options.pages.length > 0 ? options.pages : [current]
  const doc: ImageEditorDocument = {
    schema: DOCUMENT_SCHEMA_ID,
    version: 1,
    frame: { ...options.frame },
    fields: options.fields ?? [],
    meta: { title: options.title, ...(options.meta ?? {}) },
    pages: pageObjects.map((objects, index) => ({
      id: `page-${index + 1}`,
      name: `Page ${index + 1}`,
      duration: undefined,
      objects: index === 0 ? current : objects,
      background: { fill: options.frame.fill },
      animation: index === 0 ? pageAnimationOf(canvas) : { layers: {} },
    })),
  }
  return syncFieldsFromObjects(doc)
}

/** doc → canvas: swap editable page objects; returns the loaded page index. */
export async function loadPageIntoCanvas(canvas: Canvas, doc: ImageEditorDocument, pageIndex: number): Promise<number> {
  ensureObjectProperties()
  const index = Math.max(0, Math.min(pageIndex, doc.pages.length - 1))
  const page = doc.pages[index]
  if (!page) return 0
  currentPageAnimation = page.animation
    ? { layers: { ...page.animation.layers }, ...(page.animation.transition ? { transition: { ...page.animation.transition } } : {}) }
    : { layers: {} }

  // Fabric v7 defaults to a centered origin. Documents authored elsewhere (or
  // our seeds) omit originX/originY, which would shift every layer by half its
  // size and clip it; default them to left/top when absent.
  const pageObjects = dedupeObjects((page.objects ?? []).map(object => ({
    originX: 'left',
    originY: 'top',
    ...object,
  })))
  const pageBackground = pageObjects.find(object => object.id === '__background')
  const objects = pageBackground ? [pageBackground, ...pageObjects.filter(object => object !== pageBackground)] : pageObjects
  const background = (page.background?.fill && typeof page.background.fill === 'string') ? page.background.fill : doc.frame.fill
  await canvas.loadFromJSON({ version: '7.0.0', objects, background })
  hydrateVideoObjects(canvas)
  canvas.requestRenderAll()
  return index
}

/**
 * Upgrade persisted video layers back to live <video> elements. The document
 * stores a poster in `src`, so Fabric initially creates a plain image; swapping
 * the element keeps the layer's geometry and starts playback.
 */
export function hydrateVideoObjects(canvas: Canvas): void {
  for (const object of canvas.getObjects()) {
    const record = object as unknown as {
      type?: string; videoUrl?: string; poster?: string; width?: number; height?: number
      setElement?: (element: HTMLVideoElement, size: { width: number; height: number }) => void
    }
    if (record.type !== 'image' || !record.videoUrl || typeof document === 'undefined') continue
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.autoplay = true
    if (record.poster) video.poster = record.poster
    // Fabric uses element.width/height (not videoWidth) when drawing a video.
    video.width = record.width ?? 0
    video.height = record.height ?? 0
    video.src = record.videoUrl
    video.load()
    record.setElement?.(video, { width: record.width ?? 0, height: record.height ?? 0 })
    ;(object as { dirty?: boolean; objectCaching?: boolean }).objectCaching = false
    ;(object as { dirty?: boolean }).dirty = true
    video.play().catch(() => {})
  }
  canvas.fire('video:hydrated' as never)
}

/* ------------------------------------------------------------------ */
/* field application (live canvas preview without server round trip)   */
/* ------------------------------------------------------------------ */

export type LiveFieldValue = Partial<Record<FieldSuffix, DynamicFieldValue>>

const SUFFIX_TO_PROP: Partial<Record<FieldSuffix, string>> = {
  text: 'text',
  image_url: 'src',
  video_url: 'src',
  color: 'fill',
  font_family: 'fontFamily',
  font_size: 'fontSize',
  visible: 'visible',
}

/** Apply a field value to every canvas object bound via {name}/linkData. */
export async function applyFieldValue(canvas: Canvas, name: string, values: LiveFieldValue, doc: ImageEditorDocument): Promise<number> {
  const field = doc.fields.find(entry => entry.name === name)
  let touched = 0
  for (const object of canvas.getObjects()) {
    const id = (object as { id?: string }).id
    const objectName = String((object as unknown as { name?: string }).name ?? '')
    const boundTargets = (field?.targets ?? []).filter(target => target.objectId === id)
    const isNamed = objectName === `{${name}}`
    if (boundTargets.length === 0 && !isNamed) continue
    const properties = boundTargets.length > 0 ? boundTargets.map(target => target.property) : (['text'] as FieldSuffix[])
    for (const suffix of properties) {
      const value = values[suffix]
      if (value === undefined) continue
      await applyToLiveObject(object, suffix, value)
      touched += 1
    }
  }
  canvas.requestRenderAll()
  return touched
}

async function applyToLiveObject(object: FabricObject, suffix: FieldSuffix, value: DynamicFieldValue): Promise<void> {
  const prop = SUFFIX_TO_PROP[suffix]
  if (!prop) return
  if (suffix === 'image_url' || suffix === 'video_url') {
    if (typeof value === 'string') await replaceImageSource(object, value)
    return
  }
  // Direct assignment skips Fabric's property setter and leaves text layout
  // (`_textLines`, measured dimensions) stale, so the canvas kept rendering the
  // old string. `set` marks the object dirty and runs the setters.
  object.set(prop as never, value as never)
  if (suffix === 'text') {
    ;(object as unknown as { initDimensions?: () => void }).initDimensions?.()
  }
  object.dirty = true
  object.setCoords?.()
}

/** Swap an image element (stock replace/field image_url) — keeps size unless resize is true. */
export async function replaceImageSource(object: FabricObject, src: string, resize = false): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    const element = new Image()
    element.crossOrigin = 'anonymous'
    element.onload = () => {
      const record = object as unknown as {
        width?: number; height?: number; videoUrl?: string
        setElement?: (element: HTMLImageElement, size: { width: number; height: number }) => void
      }
      // Fabric v7 keeps the element in `_element`; assigning `element` silently
      // did nothing, so image variables and stock "replace" never repainted.
      const width = resize ? element.naturalWidth : (record.width ?? element.naturalWidth)
      const height = resize ? element.naturalHeight : (record.height ?? element.naturalHeight)
      record.videoUrl = undefined
      if (record.setElement) record.setElement(element, { width, height })
      if (resize) {
        object.set('scaleX', 1)
        object.set('scaleY', 1)
      }
      object.dirty = true
      object.setCoords?.()
      resolvePromise()
    }
    element.onerror = () => resolvePromise()
    element.src = src
  })
}

/* ------------------------------------------------------------------ */
/* inserts                                                             */
/* ------------------------------------------------------------------ */

/** fabric insert spec for a shape-pack entry. */
export function shapeInsertSpec(entry: ShapeEntry): Partial<EditorObject> & { left: number; top: number } {
  const base = {
    id: `shape-${entry.id}-${Math.random().toString(36).slice(2, 8)}`,
    name: entry.name,
    fill: entry.fill,
    left: 100,
    top: 100,
  }
  if (entry.kind === 'path') return { ...base, type: 'path', path: entry.path, viewBoxWidth: 100, viewBoxHeight: 100 }
  if (entry.kind === 'circle') return { ...base, type: 'circle', radius: 60 }
  if (entry.kind === 'triangle') return { ...base, type: 'triangle', width: 140, height: 140 }
  return { ...base, type: 'rect', width: 160, height: 120 }
}

/** Shape catalog lookup the panels use to render mini previews + insert. */
export function findShape(id: string): ShapeEntry | undefined {
  return SHAPE_CATALOG.find(entry => entry.id === id)
}
