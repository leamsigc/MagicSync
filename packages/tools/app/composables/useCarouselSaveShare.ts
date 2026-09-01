/**
 * useCarouselSaveShare — Save/Share composable for carousel-creator.
 *
 * Dual-storage CRUD:
 * - Logged-in users: carousels persist to the database via `/api/v1/carousel`
 * - Guests: carousels persist locally in IndexedDB (`carousel-db`)
 *
 * Sharing to a public URL is available for logged-in users only.
 */
import type { Ref } from 'vue'
import {
  saveLocalCarousel,
  getLocalCarousel,
  getAllLocalCarousels,
  deleteLocalCarousel,
} from '../utils/carousel-db'

export interface CarouselSlideData {
  kicker?: string
  headline: string
  body?: string
  items?: string[]
  quote?: string
  author?: string
  stat?: string
  statLabel?: string
  cta?: string
  footer?: string
  images?: string[]
  borderRadius?: number
}

export interface CarouselSlide {
  id: string
  templateKey: string
  data: CarouselSlideData
  pattern: string
  patternColor: string
  patternOpacity: number
  bgImage: { url: string; dim: number; shadow: { x: number; y: number; blur: number; opacity: number }; transform?: { x: number; y: number; scale: number } } | null
  customHtml: string
  /** Layer-based slides (new format). */
  layers?: Array<Record<string, unknown>>
}

export interface CarouselPalette {
  bg: string
  text: string
  accent: string
  font?: string
}

export interface CarouselData {
  id: string
  name: string
  slides: CarouselSlide[]
  palette: CarouselPalette
  pattern?: string
  handle?: string
}

export interface SavedCarousel {
  id: string
  name: string
  slides: CarouselSlide[]
  palette: CarouselPalette
  pattern?: string
  handle?: string
  isPublic?: boolean
  shareSlug?: string
  updatedAt?: string
}

export type CarouselStorageMode = 'database' | 'local'

function getShareUrl(slug: string): string {
  return `${window.location.origin}/tools/carousel/shared/${slug}`
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const err = error as { data?: { statusMessage?: string } }
  return err?.data?.statusMessage ?? fallback
}

function toSavedCarouselFromLocal(c: { id: string; name: string; slides: CarouselSlide[]; palette: CarouselPalette; pattern?: string; handle?: string; lastModified: number }): SavedCarousel {
  return {
    id: c.id,
    name: c.name,
    slides: c.slides,
    palette: c.palette,
    pattern: c.pattern,
    handle: c.handle,
    isPublic: false,
    updatedAt: new Date(c.lastModified).toISOString(),
  }
}

function toCarouselDataFromLocal(c: { id: string; name: string; slides: CarouselSlide[]; palette: CarouselPalette; pattern?: string; handle?: string }): CarouselData {
  return {
    id: c.id,
    name: c.name,
    slides: c.slides,
    palette: c.palette,
    pattern: c.pattern,
    handle: c.handle,
  }
}

function toCarouselDataFromApi(res: SavedCarousel): CarouselData {
  return {
    id: res.id,
    name: res.name,
    slides: res.slides,
    palette: res.palette,
    pattern: res.pattern,
    handle: res.handle,
  }
}

export function useCarouselSaveShare(currentCarousel: Ref<CarouselData | null>) {
  const { loggedIn, fetchSession } = UseUser()
  const toast = useToast()

  const savedCarousels = useState<SavedCarousel[]>('carousel:saved', () => [])
  const isSaving = useState('carousel:isSaving', () => false)
  const isPublic = useState('carousel:isPublic', () => false)
  const shareUrl = useState<string | null>('carousel:shareUrl', () => null)
  const isLoading = useState('carousel:isLoading', () => false)

  const storageMode = computed<CarouselStorageMode>(() => (loggedIn.value ? 'database' : 'local'))

  function notifySuccess(title: string, description?: string): void {
    toast.add({ title, description, color: 'success', icon: 'i-lucide-check-circle' })
  }

  function notifyError(title: string, error: unknown, fallback: string): void {
    toast.add({ title, description: extractErrorMessage(error, fallback), color: 'error', icon: 'i-lucide-alert-circle' })
  }

  function notifyLoginRequired(): void {
    toast.add({
      title: 'Login required',
      description: 'Please log in to save your carousel.',
      color: 'warning',
      icon: 'i-lucide-alert-circle',
    })
  }

  function buildCarouselPayload(): Record<string, unknown> | null {
    if (!currentCarousel.value) return null
    return {
      id: currentCarousel.value.id,
      name: currentCarousel.value.name,
      slides: currentCarousel.value.slides,
      palette: currentCarousel.value.palette,
      pattern: currentCarousel.value.pattern,
      handle: currentCarousel.value.handle,
    }
  }

  async function saveToDatabase(): Promise<boolean> {
    if (!loggedIn.value) {
      notifyLoginRequired()
      return false
    }
    const payload = buildCarouselPayload()
    if (!payload) return false
    await $fetch('/api/v1/carousel', { method: 'POST', body: payload })
    notifySuccess('Carousel saved', `"${currentCarousel.value!.name}" saved to your account.`)
    return true
  }

  async function saveToLocal(): Promise<boolean> {
    if (!currentCarousel.value) return false
    await saveLocalCarousel({
      id: currentCarousel.value.id,
      name: currentCarousel.value.name,
      slides: currentCarousel.value.slides,
      palette: currentCarousel.value.palette,
      pattern: currentCarousel.value.pattern,
      handle: currentCarousel.value.handle,
    })
    notifySuccess('Carousel saved', `"${currentCarousel.value.name}" saved locally.`)
    return true
  }

  async function saveCarousel(): Promise<boolean> {
    if (!currentCarousel.value) return false
    isSaving.value = true
    try {
      if (storageMode.value === 'database') {
        return await saveToDatabase()
      }
      return await saveToLocal()
    } catch (error) {
      notifyError('Save failed', error, 'Could not save carousel.')
      return false
    } finally {
      isSaving.value = false
    }
  }

  async function loadSavedCarousels(): Promise<void> {
    isLoading.value = true
    try {
      await fetchSession()
      if (loggedIn.value) {
        const res = await $fetch<SavedCarousel[]>('/api/v1/carousel')
        savedCarousels.value = res ?? []
        return
      }
      const local = await getAllLocalCarousels()
      savedCarousels.value = local.map(toSavedCarouselFromLocal)
    } catch {
      savedCarousels.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function loadLocalCarousel(carouselId: string): Promise<boolean> {
    const local = await getLocalCarousel(carouselId)
    if (!local) return false
    currentCarousel.value = toCarouselDataFromLocal(local)
    isPublic.value = false
    shareUrl.value = null
    return true
  }

  async function loadDatabaseCarousel(carouselId: string): Promise<boolean> {
    if (!loggedIn.value) return false
    try {
      const res = await $fetch<SavedCarousel>(`/api/v1/carousel/${carouselId}`)
      if (!res) return false
      currentCarousel.value = toCarouselDataFromApi(res)
      isPublic.value = res.isPublic ?? false
      shareUrl.value = res.shareSlug ? getShareUrl(res.shareSlug) : null
      return true
    } catch {
      return false
    }
  }

  async function loadCarousel(carouselId: string): Promise<boolean> {
    if (storageMode.value === 'local') {
      return await loadLocalCarousel(carouselId)
    }
    return await loadDatabaseCarousel(carouselId)
  }

  async function deleteLocalCarouselById(carouselId: string): Promise<boolean> {
    await deleteLocalCarousel(carouselId)
    savedCarousels.value = savedCarousels.value.filter(c => c.id !== carouselId)
    notifySuccess('Carousel deleted')
    return true
  }

  async function deleteDatabaseCarousel(carouselId: string): Promise<boolean> {
    if (!loggedIn.value) return false
    try {
      await $fetch(`/api/v1/carousel/${carouselId}`, { method: 'DELETE' })
      savedCarousels.value = savedCarousels.value.filter(c => c.id !== carouselId)
      notifySuccess('Carousel deleted')
      return true
    } catch {
      notifyError('Delete failed', null, 'Could not delete carousel.')
      return false
    }
  }

  async function deleteCarousel(carouselId: string): Promise<boolean> {
    if (storageMode.value === 'local') {
      return await deleteLocalCarouselById(carouselId)
    }
    return await deleteDatabaseCarousel(carouselId)
  }

  async function publishCarousel(): Promise<string | null> {
    if (!currentCarousel.value || !loggedIn.value) return null
    const saved = await saveCarousel()
    if (!saved) return null
    try {
      const res = await $fetch<{ slug: string }>(`/api/v1/carousel/${currentCarousel.value.id}/share`, { method: 'POST' })
      isPublic.value = true
      shareUrl.value = getShareUrl(res.slug)
      notifySuccess('Carousel published', 'Share link is now active.')
      return shareUrl.value
    } catch (error) {
      notifyError('Publish failed', error, 'Could not publish carousel.')
      return null
    }
  }

  async function unpublishCarousel(): Promise<boolean> {
    if (!currentCarousel.value || !loggedIn.value) return false
    try {
      await $fetch(`/api/v1/carousel/${currentCarousel.value.id}/unshare`, { method: 'POST' })
      isPublic.value = false
      shareUrl.value = null
      notifySuccess('Share link removed')
      return true
    } catch {
      notifyError('Unpublish failed', null, 'Could not unpublish carousel.')
      return false
    }
  }

  async function copyShareLink(): Promise<boolean> {
    if (!shareUrl.value) return false
    try {
      await navigator.clipboard.writeText(shareUrl.value)
      notifySuccess('Link copied', 'Share link copied to clipboard.')
      return true
    } catch {
      notifyError('Copy failed', null, 'Could not copy link.')
      return false
    }
  }

  return {
    savedCarousels: readonly(savedCarousels),
    isSaving: readonly(isSaving),
    isPublic: readonly(isPublic),
    shareUrl: readonly(shareUrl),
    isLoading: readonly(isLoading),
    storageMode,
    loggedIn,
    saveCarousel,
    loadSavedCarousels,
    loadCarousel,
    deleteCarousel,
    publishCarousel,
    unpublishCarousel,
    copyShareLink,
  }
}
