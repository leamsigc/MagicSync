import { computed, ref } from 'vue'
import { useFabricJs } from './useFabricJs'
import { ensureBrowserFonts, loadAllBundledFonts } from '../../../../shared/image-editor/browser-fonts'
import type { ImageEditorDocument } from '../../../../shared/image-editor/document'

/**
 * Client state for the design studio: My Designs / template library, save
 * with autosave, version history, brand kits — all through
 * /api/v1/image-editor/*.
 */

export interface DesignListItem {
  id: string
  title: string
  isPublic: boolean
  updatedAt?: string
  pages?: number
  fields?: string[]
  thumbnails?: Array<{ name: string; url: string }>
}

export interface DesignVersionItem {
  id: string
  version: number
  title: string
  createdAt: string | Date
}

export interface BrandKit {
  id: string
  name: string
  colors: Array<{ name: string; hex: string }>
  fonts: { heading?: string; body?: string }
  logoUrl?: string | null
  isDefault?: boolean
}

const designs = ref<DesignListItem[]>([])
const templates = ref<DesignListItem[]>([])
const versions = ref<DesignVersionItem[]>([])
const brandKits = ref<BrandKit[]>([])
const currentId = ref<string | null>(null)
const currentTitle = ref('Untitled design')
const busy = ref<string | null>(null)
const lastSavedAt = ref<string | null>(null)
const dirty = ref(false)
/** True when the API rejected the session (anonymous visitor on the public tool). */
const requiresAuth = ref(false)

const designsPage = ref(0)
const hasMoreDesigns = ref(false)

export const AUTOSAVE_DELAY_MS = 4000

/** 401 → the visitor is anonymous; panels show a sign-in call to action. */
function isUnauthorized(error: unknown): boolean {
  const candidate = error as { statusCode?: number; status?: number; response?: { status?: number } }
  const status = candidate?.statusCode ?? candidate?.status ?? candidate?.response?.status
  return status === 401
}

export function useDesignStudio() {
  const { t } = useI18n()
  const { editor } = useFabricJs()

  const studio = () => editor.value?.getPlugin?.('studio') as {
    loadDocument: (doc: ImageEditorDocument, page?: number) => Promise<boolean>
    currentDocument: () => ImageEditorDocument
    syncVariables: () => { doc: ImageEditorDocument; issues: Array<{ code: string; name: string; detail?: string }> }
  } | undefined

  const hasDocument = computed(() => !!studio())

  async function fetchDesigns(query = '', page = 0): Promise<void> {
    busy.value = 'designs'
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    params.set('page', String(page + 1))
    params.set('limit', '24')
    try {
      const response = await $fetch<{ data?: DesignListItem[]; success?: boolean }>(`/api/v1/image-editor/designs?${params}`, { method: 'GET' })
      const rows = Array.isArray(response) ? response : response.data ?? response
      if (Array.isArray(rows)) {
        designs.value = page === 0 ? rows : [...designs.value, ...rows]
        designsPage.value = page
        hasMoreDesigns.value = rows.length >= 24
        requiresAuth.value = false
      }
    } catch (error) {
      if (isUnauthorized(error)) requiresAuth.value = true
    }
    busy.value = null
  }

  async function fetchTemplates(query = ''): Promise<void> {
    busy.value = 'templates'
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    params.set('scope', 'public')
    params.set('limit', '24')
    try {
      const response = await $fetch<{ data?: DesignListItem[] }>(`/api/v1/image-editor/designs?${params}`, { method: 'GET' })
      const rows = Array.isArray(response) ? response : response.data ?? []
      templates.value = rows.map(row => ({ ...row, isPublic: true }))
      requiresAuth.value = false
    } catch (error) {
      if (isUnauthorized(error)) requiresAuth.value = true
      templates.value = []
    }
    busy.value = null
  }

  /* ------------------------------------------------------------- open/save */

  /**
   * Open a public template. Signed-in users get their own copy (the library
   * is never edited in place); anonymous visitors load the public document
   * directly, unsaved, so the free templates work without an account.
   */
  async function openTemplate(id: string): Promise<boolean> {
    busy.value = 'open'
    try {
      const copy = await $fetch<{ id: string }>(`/api/v1/image-editor/designs/${id}/duplicate`, { method: 'POST', body: {} })
      busy.value = null
      void fetchDesigns('', 0)
      return await openDesign(copy.id)
    } catch (error) {
      const unauthorized = isUnauthorized(error)
      busy.value = null
      if (unauthorized) requiresAuth.value = true
      const opened = await openDesign(id, { asTemplate: unauthorized })
      if (opened && unauthorized) {
        useToast().add({
          title: t('studio.templates.openedGuest'),
          description: t('studio.templates.openedGuestDesc'),
          color: 'neutral',
          icon: 'i-lucide-eye',
        })
      }
      return opened
    }
  }

  async function openDesign(id: string, options: { asTemplate?: boolean } = {}): Promise<boolean> {
    busy.value = 'open'
    try {
      const found = await $fetch<{ id: string; document: ImageEditorDocument | null; title: string }>(`/api/v1/image-editor/designs/${id}`, { method: 'GET' })
      if (!found?.document) {
        useToast().add({ title: t('studio.design.noDocument'), color: 'warning', icon: 'i-lucide-alert-triangle' })
        busy.value = null
        return false
      }
      await studio()?.loadDocument(found.document, 0)
      currentId.value = options.asTemplate ? null : found.id
      currentTitle.value = found.title
      dirty.value = !!options.asTemplate
      lastSavedAt.value = null
      if (!options.asTemplate) void fetchVersions(id)
      busy.value = null
      return true
    } catch (error) {
      useToast().add({
        title: t('studio.design.openFailed'),
        description: error instanceof Error ? error.message : String(error),
        color: 'error',
        icon: 'i-lucide-x-circle',
      })
      busy.value = null
      return false
    }
  }

  function previewOf(): string | null {
    return useFabricJs().getFrameDataUrl()
  }

  function thumbnailPayload(): Array<{ name: string; url: string }> {
    const dataUrl = previewOf()
    return dataUrl ? [{ name: 'thumb-0.png', url: dataUrl.slice(0, 250_000) }] : []
  }

  /** PUT an existing design or POST a new one; sets currentId for new saves. */
  async function persistDesign(doc: unknown, options: { asNew?: boolean; silent?: boolean }): Promise<void> {
    if (currentId.value && !options.asNew) {
      await $fetch(`/api/v1/image-editor/designs/${currentId.value}`, {
        method: 'PUT',
        body: { doc, title: currentTitle.value, snapshot: !options.silent },
      })
      lastSavedAt.value = new Date().toISOString()
      return
    }
    const created = await $fetch<{ id: string }>('/api/v1/image-editor/designs', {
      method: 'POST',
      body: { title: currentTitle.value, doc, thumbnails: thumbnailPayload() },
    })
    currentId.value = created.id
    lastSavedAt.value = new Date().toISOString()
  }

  /** Success feedback + list refresh (silent autosaves skip both). */
  function afterSave(options: { silent?: boolean }): void {
    dirty.value = false
    designs.value = []
    if (options.silent) return
    useToast().add({ title: t('studio.design.saved'), color: 'success', icon: 'i-lucide-check' })
    void fetchDesigns('', 0).then(listVersionsForIfOpen)
  }

  async function saveDesign(options: { asNew?: boolean; silent?: boolean } = {}): Promise<string | null> {
    const plugin = studio()
    if (!plugin) {
      if (!options.silent) useToast().add({ title: t('studio.design.loading'), color: 'warning', icon: 'i-lucide-loader' })
      return null
    }
    busy.value = 'save'
    try {
      await persistDesign(plugin.currentDocument(), options)
      afterSave(options)
      busy.value = null
      return currentId.value
    } catch {
      busy.value = null
      if (!options.silent) useToast().add({ title: t('studio.design.saveFailed'), color: 'error', icon: 'i-lucide-x-circle' })
      return null
    }
  }

  function listVersionsForIfOpen(): void {
    if (currentId.value) void fetchVersions(currentId.value)
  }

  async function listVersionsFor(id: string): Promise<void> {
    currentId.value = id
    await fetchVersions(id)
  }

  async function fetchVersions(id: string): Promise<void> {
    try {
      const response = await $fetch<{ versions: DesignVersionItem[] }>(`/api/v1/image-editor/designs/${id}/versions`, { method: 'GET' })
      versions.value = response?.versions ?? []
    } catch {
      versions.value = []
    }
  }

  async function restoreVersion(versionId: string): Promise<boolean> {
    if (!currentId.value) return false
    busy.value = 'restore'
    try {
      await $fetch(`/api/v1/image-editor/designs/${currentId.value}/versions/${versionId}`, { method: 'POST' })
      await openDesign(currentId.value)
      useToast().add({ title: t('studio.design.restored'), color: 'success', icon: 'i-lucide-history' })
      busy.value = null
      return true
    } catch {
      busy.value = null
      useToast().add({ title: t('studio.design.restoreFailed'), color: 'error', icon: 'i-lucide-x-circle' })
      return false
    }
  }

  async function duplicateDesign(id: string): Promise<string | null> {
    busy.value = 'duplicate'
    try {
      const created = await $fetch<{ id: string; document?: ImageEditorDocument }>(`/api/v1/image-editor/designs/${id}/duplicate`, { method: 'POST', body: {} })
      busy.value = null
      if (created?.id) void fetchDesigns('', 0)
      useToast().add({ title: t('studio.design.duplicated'), color: 'success', icon: 'i-lucide-copy' })
      return created?.id ?? null
    } catch {
      busy.value = null
      useToast().add({ title: t('studio.design.duplicateFailed'), color: 'error', icon: 'i-lucide-x-circle' })
      return null
    }
  }

  async function publishDesign(id: string, isPublic: boolean): Promise<boolean> {
    try {
      await $fetch(`/api/v1/image-editor/designs/${id}/publish`, { method: 'PUT', body: { isPublic } })
      const row = designs.value.find(entry => entry.id === id)
      if (row) row.isPublic = isPublic
      useToast().add({ title: isPublic ? t('studio.design.publishedOn') : t('studio.design.publishedOff'), color: 'success', icon: 'i-lucide-globe' })
      return true
    } catch {
      useToast().add({ title: t('studio.design.publishFailed'), color: 'error', icon: 'i-lucide-x-circle' })
      return false
    }
  }

  async function removeDesign(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/v1/image-editor/designs/${id}`, { method: 'DELETE' })
      designs.value = designs.value.filter(entry => entry.id !== id)
      if (currentId.value === id) currentId.value = null
      useToast().add({ title: t('studio.design.deleted'), color: 'neutral', icon: 'i-lucide-trash-2' })
      return true
    } catch {
      useToast().add({ title: t('studio.design.deleteFailed'), color: 'error', icon: 'i-lucide-x-circle' })
      return false
    }
  }

  /* ------------------------------------------------------------- brand kits */

  async function fetchBrandKits(): Promise<void> {
    try {
      const response = await $fetch<{ kits: BrandKit[] }>('/api/v1/image-editor/brand-kits', {
        method: 'POST',
        body: { action: 'list' },
      })
      brandKits.value = response?.kits ?? []
    } catch {
      brandKits.value = []
    }
  }

  async function createBrandKit(name: string, colors: Array<{ name: string; hex: string }>, fonts: { heading?: string; body?: string }): Promise<void> {
    busy.value = 'brand'
    try {
      await $fetch('/api/v1/image-editor/brand-kits', {
        method: 'POST',
        body: { action: 'create', name, colors, fonts },
      })
      await fetchBrandKits()
      useToast().add({ title: t('studio.design.kitCreated'), color: 'success', icon: 'i-lucide-swatch-book' })
    } catch {
      useToast().add({ title: t('studio.design.kitCreateFailed'), color: 'error', icon: 'i-lucide-x-circle' })
    }
    busy.value = null
  }

  async function deleteBrandKit(id: string): Promise<void> {
    try {
      await $fetch('/api/v1/image-editor/brand-kits', { method: 'POST', body: { action: 'delete', id } })
      brandKits.value = brandKits.value.filter(kit => kit.id !== id)
    } catch {
      useToast().add({ title: t('studio.design.kitDeleteFailed'), color: 'error', icon: 'i-lucide-x-circle' })
    }
  }

  /* rename + autosave ------------------------------------------------ */

  function setTitle(title: string): void {
    currentTitle.value = title
    dirty.value = true
  }

  function markDirty(): void {
    dirty.value = true
  }

  return {
    designs, templates, versions, brandKits,
    currentId, currentTitle, busy, lastSavedAt, dirty, requiresAuth,
    designsPage, hasMoreDesigns, hasDocument,
    fetchDesigns, fetchTemplates, openDesign, openTemplate, saveDesign, listVersionsFor,
    restoreVersion, duplicateDesign, publishDesign, removeDesign,
    fetchBrandKits, createBrandKit, deleteBrandKit,
    setTitle, markDirty,
    loadAllBundledFonts,
    ensureBrowserFonts,
    studioPreview: previewOf,
    AUTOSAVE_DELAY_MS,
  }
}
