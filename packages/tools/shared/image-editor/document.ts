/**
 * ImageEditorDocument@1 — the versioned design-document envelope shared by
 * the browser editor, the server renderer, the batch API and MCP callers.
 *
 * `objects` stay raw fabric (v7 serialization shape) so the document can go
 * through `loadFromJSON` / `enlivenObjects` untouched; everything structural
 * (frame, pages, fields, animation) is strongly typed here.
 */

export const DOCUMENT_SCHEMA_ID = 'magicsync/image-editor@1'

export const FIELD_SUFFIXES = [
  'text',
  'image_url',
  'video_url',
  'color',
  'font_family',
  'font_size',
  'visible',
] as const

export type FieldSuffix = (typeof FIELD_SUFFIXES)[number]

/** Flat no-code key format: fields__{name}__{suffix} */
export const FLAT_FIELD_RE = /^fields__(.+?)__(text|image_url|video_url|color|font_family|font_size|visible)$/
/** Layer-name auto-field syntax: {name} or {name:suffix} */
export const AUTO_FIELD_RE = /^\{([A-Za-z0-9_]+)(?::([a-z_]+))?\}$/
export const FIELD_NAME_RE = /^[A-Za-z0-9_]+$/

export interface FieldTarget {
  objectId: string
  property: FieldSuffix
}

export interface DesignField {
  name: string
  targets: FieldTarget[]
  default?: Partial<Record<FieldSuffix, string | number | boolean>>
}

/** Raw fabric v7 object JSON (rect/textbox/image/…); normalized in place. */
export type EditorObject = Record<string, unknown>

export type EnterAnimationType =
  | 'fadeIn' | 'riseUp' | 'dropDown' | 'slideLeft' | 'slideRight'
  | 'zoomIn' | 'zoomOut' | 'wipeUp' | 'pop' | 'none'

export type LoopAnimationType =
  | 'pulse' | 'spin' | 'bob' | 'swing' | 'blink' | 'none'

export type PageTransitionType =
  | 'none' | 'fade' | 'slideLeft' | 'slideRight' | 'wipeUp' | 'zoomIn'

export interface LayerAnimation {
  enter?: { type: EnterAnimationType; duration: number; delay: number; easing: string }
  exit?: { type: EnterAnimationType; duration: number; delay: number; easing: string }
  loop?: { type: LoopAnimationType; duration: number; easing: string }
}

export interface PageAnimation {
  layers: Record<string, LayerAnimation>
  transition?: { type: PageTransitionType; duration: number }
}

export interface EditorPage {
  id: string
  name: string
  duration?: number
  /** Optional background music muxed into the MP4 export. */
  audio?: { url: string; name?: string; volume?: number }
  objects: EditorObject[]
  background?: { fill?: string }
  clipPath?: EditorObject
  animation: PageAnimation
}

export interface DocumentMeta {
  category?: string
  tags?: string[]
  sort?: number
  price?: number
  proInfo?: string
  [key: string]: unknown
}

export interface ImageEditorDocument {
  schema: typeof DOCUMENT_SCHEMA_ID
  version: number
  frame: { width: number; height: number; fill: string }
  fields: DesignField[]
  meta: DocumentMeta
  pages: EditorPage[]
}

export function createEmptyDocument(width = 1242, height = 1660, fill = '#ffffff'): ImageEditorDocument {
  return {
    schema: DOCUMENT_SCHEMA_ID,
    version: 1,
    frame: { width, height, fill },
    fields: [],
    meta: {},
    pages: [{ id: 'page-1', name: 'Page 1', objects: [], animation: { layers: {} } }],
  }
}

export function newPageId(index: number): string {
  return `page-${index + 1}`
}

export function isValidDocument(value: unknown): value is ImageEditorDocument {
  const doc = value as ImageEditorDocument
  return Boolean(
    doc && typeof doc === 'object'
    && doc.schema === DOCUMENT_SCHEMA_ID
    && Array.isArray(doc.pages)
    && Array.isArray(doc.fields)
    && doc.frame && typeof doc.frame.width === 'number',
  )
}

/** Build fabric-compatible page JSON for the renderer / loadFromJSON. */
export function pageToFabricJson(page: EditorPage, frame: ImageEditorDocument['frame']): Record<string, unknown> {
  return {
    version: '7.4.0',
    objects: page.objects,
    background: page.background?.fill ?? frame.fill,
    clipPath: page.clipPath ?? {
      type: 'rect',
      id: 'workspace',
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      width: frame.width,
      height: frame.height,
      fill: page.background?.fill ?? frame.fill,
      strokeWidth: 0,
      selectable: false,
    },
  }
}

/** Total timeline duration across pages (ms). */
export function documentDuration(doc: ImageEditorDocument): number {
  const perPage = doc.pages.map((page) => {
    return page.duration ?? computePageDuration(page)
  })
  return perPage.reduce((sum, ms) => sum + ms, 0)
}

export function computePageDuration(page: EditorPage, fallbackMs = 4000): number {
  let latest = fallbackMs
  // Older/hand-edited documents may omit `animation.layers` entirely.
  const layers = page.animation?.layers ?? {}
  for (const layer of Object.values(layers)) {
    if (layer.exit) latest = Math.max(latest, layer.exit.delay + layer.exit.duration)
  }
  return latest
}
