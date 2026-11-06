import { BaseFabricPlugin } from '../FabricEditor'
import {
  applyFieldValue,
  buildDocumentFromCanvas,
  loadPageIntoCanvas,
  pageAnimationOf,
  setPageAnimation,
  setObjectAnimation,
  ensureObjectProperties,
  workspaceOf,
  workspaceSizeOf,
  type LiveFieldValue,
} from '../../../../../../shared/image-editor/studio-canvas'
import { syncFieldsFromObjects, validateFields, withSchema } from '../../../../../../shared/image-editor/fields'
import { documentPagesFonts } from '../../../../../../shared/image-editor/font-helpers'
import { ensureBrowserFonts } from '../../../../../../shared/image-editor/browser-fonts'
import { loadGoogleFont } from '../../../../../../shared/image-editor/google-fonts'
import type { DocumentMeta, EditorPage, ImageEditorDocument, LayerAnimation } from '../../../../../../shared/image-editor/document'

/**
 * StudioPlugin — the design-studio side of the editor: keeps the
 * ImageEditorDocument envelope in sync with the canvas, loads templates and
 * saved designs, and applies bound {variable} values to live objects.
 */
function clearVariableBinding(
  target: Record<string, unknown> & { name?: string; linkData?: unknown },
  name: string,
): void {
  const link = target.linkData
  if (Array.isArray(link) && String(link[1] ?? '') === name) target.linkData = undefined
  if (target.name === `{${name}}`) target.name = undefined
}

export class StudioPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'studio';
  override readonly pluginName = 'studio';

  override readonly exposedMethods = [
    'loadDocument',
    'currentDocument',
    'syncVariables',
    'applyVariable',
    'setLayerAnimation',
    'setPageTransition',
    'setPageDuration',
    'setPageAudio',
    'getPageAudio',
    'setDocumentMeta',
    'createVariableFromSelection',
    'bindSelectionToVariable',
  ];

  /** Source document — other pages / meta / fields are preserved from here. */
  private baseDoc: ImageEditorDocument | null = null
  private pageIndex = 0
  private pageDurationMs = 4000
  private pageAudio: EditorPage['audio'] | null = null

  protected init() {
    // Fabric drops custom keys (id/name/linkData) unless they are registered.
    // loadPageIntoCanvas registers them too, but a blank editor creates layers
    // before any document load — without this, a variable created on a fresh
    // image/text layer never survives serialization.
    ensureObjectProperties()
  }

  async loadDocument(doc: ImageEditorDocument, pageIndex = 0): Promise<boolean> {
    if (!this.canvas) return false
    this.baseDoc = withSchema(doc)
    await this.ensureDocumentFonts(documentPagesFonts(this.baseDoc))
    const frame = this.baseDoc.frame
    this.editor.globalSettings.value.width = frame.width
    this.editor.globalSettings.value.height = frame.height
    this.editor.globalSettings.value.fill = frame.fill
    // loadFromJSON replaces every canvas object (including the workspace rect),
    // so the frame must be (re)created AFTER the page is on the canvas.
    this.pageIndex = await loadPageIntoCanvas(this.canvas, this.baseDoc, pageIndex)
    const core = this.editor.getPlugin('core') as { setSize?: (width: number, height: number) => void } | undefined
    core?.setSize?.(frame.width, frame.height)
    this.pageDurationMs = this.baseDoc.pages[this.pageIndex]?.duration ?? 4000
    this.pageAudio = this.baseDoc.pages[this.pageIndex]?.audio ?? null
    setPageAnimation(pageAnimationOf(this.canvas))
    return true
  }

  /**
   * Load bundled faces and their Google fallbacks. Bundled assets may be
   * absent (lightweight dev installs), so the CDN is the safety net; it is
   * deadline-capped and any late arrival re-measures wrapping text.
   */
  private async ensureDocumentFonts(families: string[]): Promise<void> {
    const jobs = Promise.all([
      ensureBrowserFonts(families),
      ...families.map(family => loadGoogleFont(family)),
    ]).catch(() => [])
    await Promise.race([jobs, new Promise(resolve => setTimeout(resolve, 4000))])
    void jobs.then(() => this.remeasureText())
  }

  private remeasureText(): void {
    const canvas = this.canvas
    if (!canvas) return
    for (const object of canvas.getObjects()) {
      const target = object as unknown as { initDimensions?: () => void }
      target.initDimensions?.()
    }
    canvas.requestRenderAll()
  }

  /** Snapshot the canvas into the envelope (page-0 objects replaced). */
  currentDocument(): ImageEditorDocument {
    if (!this.canvas) throw new Error('Studio editor not initialized')
    const size = workspaceSizeOf(this.canvas)
    // The viewport behind the frame is transparent-grey; the document fill is
    // the workspace rect's fill (white by default).
    const workspaceFill = workspaceOf(this.canvas)?.fill
    const fill = typeof workspaceFill === 'string' ? workspaceFill : '#ffffff'
    const doc = buildDocumentFromCanvas(this.canvas, {
      frame: { width: size.width, height: size.height, fill },
      title: this.baseDoc?.meta?.title ?? undefined,
      meta: this.baseDoc?.meta,
      fields: this.baseDoc?.fields,
      pages: this.baseDoc && this.baseDoc.pages.length > 1
        ? this.baseDoc.pages.map(page => page.objects)
        : undefined,
    })
    doc.pages[0].animation = pageAnimationOf(this.canvas)
    doc.pages[0].duration = this.pageDurationMs
    if (this.pageAudio) doc.pages[0].audio = { ...this.pageAudio }
    return doc
  }

  /** Fields after syncing {names} on the canvas. */
  syncVariables(): { doc: ImageEditorDocument; issues: { code: string; name: string; detail?: string }[] } {
    const doc = syncFieldsFromObjects(this.currentDocument())
    this.baseDoc = doc
    return { doc, issues: validateFields(doc) }
  }

  /** Write variable values into canvas objects bound to {name}. */
  async applyVariable(name: string, values: LiveFieldValue): Promise<number> {
    if (!this.canvas) return 0
    const doc = this.currentDocument()
    return applyFieldValue(this.canvas, name, values, doc)
  }

  /** Store enter/exit/loop animation for an object id (persisted via serialization). */
  setLayerAnimation(objectId: string, spec: LayerAnimation): void {
    if (!this.canvas) return
    const target = this.canvas.getObjects().find(obj => (obj as { id?: string }).id === objectId)
    if (!target) return
    setObjectAnimation(target, spec)
    this.canvas.requestRenderAll()
  }

  setPageTransition(type: string, durationMs: number): void {
    if (!this.canvas) return
    const anim = pageAnimationOf(this.canvas)
    anim.transition = { type: type as never, duration: Math.max(0, Math.floor(durationMs)) }
    setPageAnimation(anim)
    this.canvas.requestRenderAll()
  }

  setPageDuration(ms: number): void {
    this.pageDurationMs = Math.max(500, Math.floor(ms))
  }

  getPageDuration(): number {
    return this.pageDurationMs
  }

  /** Background music for the MP4 export (asset URL + volume 0-100). */
  setPageAudio(audio: EditorPage['audio'] | null): void {
    this.pageAudio = audio
    if (this.baseDoc?.pages[this.pageIndex]) {
      this.baseDoc.pages[this.pageIndex] = { ...this.baseDoc.pages[this.pageIndex], audio: audio ?? undefined }
    }
  }

  getPageAudio(): EditorPage['audio'] | null {
    return this.pageAudio
  }

  /**
   * Turn the selected layer into a variable: assigns an id when missing and
   * writes `linkData = [property, name]` so the layer binds to `{name}`.
   */
  createVariableFromSelection(name: string, property?: FieldSuffix): boolean {
    const value = name.trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '')
    if (!this.canvas || !value) return false
    const target = this.canvas.getActiveObject() as (Record<string, unknown> & { type?: string }) | undefined
    if (!target) return false
    const suffix = property ?? this.defaultSuffixFor(target.type)
    target.id = (target.id as string | undefined) ?? `layer-${Math.random().toString(36).slice(2, 8)}`
    target.linkData = [suffix, value]
    if (suffix === 'text') target.name = `{${value}}`
    this.refreshAfterVariableChange()
    return true
  }

  /** Bind the selected layer to an existing variable/property. */
  bindSelectionToVariable(name: string, property?: FieldSuffix): boolean {
    if (!this.canvas || !name) return false
    const target = this.canvas.getActiveObject() as (Record<string, unknown> & { type?: string }) | undefined
    if (!target) return false
    const suffix = property ?? this.defaultSuffixFor(target.type)
    target.id = (target.id as string | undefined) ?? `layer-${Math.random().toString(36).slice(2, 8)}`
    target.linkData = [suffix, name]
    if (suffix === 'text') target.name = `{${name}}`
    this.refreshAfterVariableChange()
    return true
  }

  /** Remove the active layer's binding to a variable, keeping the variable. */
  unbindSelectionFromVariable(name: string): boolean {
    if (!this.canvas || !name) return false
    const target = this.canvas.getActiveObject() as (Record<string, unknown> & { name?: string; linkData?: unknown }) | undefined
    if (!target) return false
    clearVariableBinding(target, name)
    this.refreshAfterVariableChange()
    return true
  }

  /** Delete a variable and clear every layer binding that points at it. */
  deleteVariable(name: string): boolean {
    if (!this.canvas || !name) return false
    let touched = false
    for (const object of this.canvas.getObjects()) {
      const record = object as unknown as { name?: string; linkData?: unknown }
      const link = record.linkData
      const wasBound = record.name === `{${name}}`
        || (Array.isArray(link) && String(link[1] ?? '') === name)
      clearVariableBinding(record, name)
      if (wasBound) touched = true
    }
    if (this.baseDoc) this.baseDoc.fields = this.baseDoc.fields.filter(field => field.name !== name)
    this.refreshAfterVariableChange()
    return touched
  }

  private defaultSuffixFor(type: string | undefined): FieldSuffix {
    if (type === 'image') return 'image_url'
    if (type === 'textbox' || type === 'i-text' || type === 'text') return 'text'
    return 'color'
  }

  private refreshAfterVariableChange(): void {
    const { doc } = this.syncVariables()
    this.baseDoc = doc
    this.canvas?.requestRenderAll()
  }

  setDocumentMeta(meta: DocumentMeta): void {
    const doc = this.currentDocument()
    doc.meta = { ...doc.meta, ...meta }
    this.baseDoc = doc
  }
}
