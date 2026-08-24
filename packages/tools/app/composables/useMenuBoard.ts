/**
 *
 * useMenuBoard — Dynamic Menu Board tool composable.
 *
 * Dual-storage CRUD:
 * - Logged-in users: boards persist to the database via `/api/v1/menu-board`
 *   (backed by the generic `entity_details` table).
 * - Guests: boards persist locally in IndexedDB (`menu-board-db`).
 *
 * Sharing to a public URL is available for logged-in users only.
 */
import {
  saveLocalBoard,
  getLocalBoard,
  getAllLocalBoards,
  deleteLocalBoard,
} from '../utils/menu-board-db'
import {
  DEFAULT_BOARD_SETTINGS,
  sortActivePages,
  type MenuBoard,
  type MenuPage,
} from '../pages/tools/menu-board/types'
import { MENU_TEMPLATES } from '../pages/tools/menu-board/templates'
import { requestFullscreen, exitImmersive, isFullscreenActive } from '../pages/tools/menu-board/utils/fullscreen'

export type MenuBoardStorageMode = 'database' | 'local'

export function createMenuPage(partial: Partial<MenuPage> = {}): MenuPage {
  return {
    id: crypto.randomUUID(),
    name: partial.name ?? 'New Page',
    type: partial.type ?? 'html',
    content: partial.content ?? '',
    isActive: partial.isActive ?? true,
    order: partial.order ?? 0,
  }
}

function seedGuestBoard(): MenuBoard {
  const starter = MENU_TEMPLATES.find(t => t.id === 'classic-bistro') ?? MENU_TEMPLATES.find(t => t.id === 'blank') ?? MENU_TEMPLATES[0]
  return {
    id: crypto.randomUUID(),
    name: 'My First Board',
    pages: [createMenuPage({ name: starter.name, content: starter.content })],
    settings: { ...DEFAULT_BOARD_SETTINGS },
    lastModified: Date.now(),
  }
}

export const useMenuBoard = () => {
  const { loggedIn, fetchSession } = UseUser()
  // Capture once inside setup context so toasts work from any method.
  const toast = useToast()

  const boards = useState<MenuBoard[]>('menu-board:boards', () => [])
  const currentBoard = useState<MenuBoard | null>('menu-board:current', () => null)
  const isLoading = useState('menu-board:isLoading', () => false)
  const isSaving = useState('menu-board:isSaving', () => false)
  const isDirty = useState('menu-board:isDirty', () => false)
  const mode = useState<'admin' | 'display'>('menu-board:mode', () => 'admin')

  const storageMode = computed<MenuBoardStorageMode>(() => (loggedIn.value ? 'database' : 'local'))

  // ---------- persistence helpers ----------

  /** Plain-object deep copy — Vue reactive proxies cannot be structured-cloned into IndexedDB. */
  function toPlain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
  }

  async function persistBoard(board: MenuBoard): Promise<void> {
    if (storageMode.value === 'database') {
      await $fetch('/api/v1/menu-board', {
        method: 'POST',
        body: {
          id: board.id,
          name: board.name,
          pages: board.pages,
          settings: board.settings,
        },
      })
      return
    }
    await saveLocalBoard(toPlain(board))
  }

  async function loadBoards(): Promise<void> {
    isLoading.value = true
    try {
      await fetchSession()

      if (loggedIn.value) {
        const res = await $fetch<{ boards: Array<MenuBoard & { updatedAt?: string }> }>('/api/v1/menu-board')
        boards.value = (res.boards ?? []).map(b => ({ ...b }))
        return
      }

      let local = await getAllLocalBoards()
      if (local.length === 0) {
        const seeded = seedGuestBoard()
        await saveLocalBoard(seeded)
        local = [seeded]
      }
      boards.value = local.sort((a, b) => b.lastModified - a.lastModified)
    } finally {
      isLoading.value = false
    }
  }

  async function selectBoard(id: string): Promise<void> {
    const known = boards.value.find(b => b.id === id)
    if (known) {
      currentBoard.value = JSON.parse(JSON.stringify(known))
      isDirty.value = false
      return
    }
    if (storageMode.value === 'local') {
      const local = await getLocalBoard(id)
      if (local) {
        currentBoard.value = JSON.parse(JSON.stringify(local))
        isDirty.value = false
      }
    }
  }

  async function newBoard(name = 'Untitled Board'): Promise<MenuBoard> {
    const board: MenuBoard = {
      id: crypto.randomUUID(),
      name,
      pages: [createMenuPage({ content: MENU_TEMPLATES[0]?.content ?? '' })],
      settings: { ...DEFAULT_BOARD_SETTINGS },
      lastModified: Date.now(),
    }
    await persistBoard(board)
    boards.value = [board, ...boards.value]
    currentBoard.value = board
    isDirty.value = false
    return board
  }

  async function saveBoard(): Promise<void> {
    if (!currentBoard.value) return
    isSaving.value = true
    try {
      const board = { ...currentBoard.value, lastModified: Date.now() }
      await persistBoard(board)
      currentBoard.value = board
      const idx = boards.value.findIndex(b => b.id === board.id)
      if (idx >= 0) boards.value.splice(idx, 1, board)
      else boards.value.unshift(board)
      isDirty.value = false

      toast.add({
        title: 'Saved',
        description:
          storageMode.value === 'database'
            ? `"${board.name}" saved to your account.`
            : `"${board.name}" saved on this device.`,
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    } catch {
      toast.add({
        title: 'Save failed',
        description: 'Could not save the board. Please try again.',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    } finally {
      isSaving.value = false
    }
  }

  async function removeBoard(id: string): Promise<void> {
    if (storageMode.value === 'database' && loggedIn.value) {
      await $fetch(`/api/v1/menu-board/${id}`, { method: 'DELETE' })
    } else {
      await deleteLocalBoard(id)
    }
    boards.value = boards.value.filter(b => b.id !== id)
    if (currentBoard.value?.id === id) {
      currentBoard.value = null
    }
  }

  // ---------- sharing (logged-in only) ----------

  async function setShared(isPublic: boolean): Promise<string | null> {
    if (!currentBoard.value || storageMode.value !== 'database') return null

    // The public snapshot mirrors the saved state — persist before sharing.
    await saveBoard()

    const res = await $fetch<{ isPublic: boolean; slug: string | null }>(
      `/api/v1/menu-board/${currentBoard.value.id}/share`,
      { method: 'POST', body: { isPublic } },
    )

    currentBoard.value = { ...currentBoard.value, isPublic }
    const idx = boards.value.findIndex(b => b.id === currentBoard.value?.id)
    if (idx >= 0 && currentBoard.value) boards.value.splice(idx, 1, { ...currentBoard.value })

    return isPublic && res.slug ? `${window.location.origin}/tools/menu-board/shared/${res.slug}` : null
  }

  // ---------- page CRUD ----------

  function mutatePages(fn: (pages: MenuPage[]) => MenuPage[]): void {
    if (!currentBoard.value) return
    const pages = fn(JSON.parse(JSON.stringify(currentBoard.value.pages)))
    pages.forEach((p, i) => { p.order = i })
    currentBoard.value = { ...currentBoard.value, pages }
    isDirty.value = true
  }

  function addPageFromTemplate(templateId: string): void {
    const template = MENU_TEMPLATES.find(t => t.id === templateId)
    if (!template || !currentBoard.value) return
    mutatePages(pages => [
      ...pages,
      createMenuPage({ name: template.name, content: template.content, order: pages.length }),
    ])
  }

  function addImagePage(): void {
    if (!currentBoard.value) return
    mutatePages(pages => [
      ...pages,
      createMenuPage({ name: 'New Image Page', type: 'image', content: '', order: pages.length }),
    ])
    isDirty.value = true
  }

  function duplicatePage(pageId: string): void {
    mutatePages((pages) => {
      const source = pages.find(p => p.id === pageId)
      if (!source) return pages
      return [...pages, { ...source, id: crypto.randomUUID(), name: `${source.name} (Copy)` }]
    })
  }

  function updatePage(pageId: string, updates: Partial<MenuPage>): void {
    mutatePages(pages => pages.map(p => (p.id === pageId ? { ...p, ...updates } : p)))
  }

  function removePage(pageId: string): void {
    mutatePages(pages => pages.filter(p => p.id !== pageId))
  }

  function movePage(pageId: string, direction: -1 | 1): void {
    if (!currentBoard.value) return
    const ordered = [...currentBoard.value.pages].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex(p => p.id === pageId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    mutatePages(() => ordered)
  }

  function updateSettings(updates: Partial<MenuBoard['settings']>): void {
    if (!currentBoard.value) return
    currentBoard.value = { ...currentBoard.value, settings: { ...currentBoard.value.settings, ...updates } }
    isDirty.value = true
  }

  function renameBoard(name: string): void {
    if (!currentBoard.value) return
    currentBoard.value = { ...currentBoard.value, name }
    isDirty.value = true
  }

  // ---------- AI assistant ----------

  async function generateWithAi(prompt: string, currentHtml?: string): Promise<string> {
    const res = await $fetch<{ html: string }>('/api/v1/menu-board/ai', {
      method: 'POST',
      body: { prompt, currentHtml },
    })
    return res.html
  }

  // ---------- display mode ----------

  function activeSortedPages(): MenuPage[] {
    return sortActivePages(currentBoard.value?.pages ?? [])
  }

  async function enterDisplayMode(withFullscreen = true): Promise<void> {
    mode.value = 'display'
    if (withFullscreen && import.meta.client) {
      // Restaurant TVs run the board as a true fullscreen display.
      await requestFullscreen()
    }
  }

  async function exitDisplayMode(): Promise<void> {
    mode.value = 'admin'
    if (import.meta.client && isFullscreenActive()) {
      await exitImmersive()
    }
  }

  async function lockAndStartDisplay(): Promise<boolean> {
    if (!currentBoard.value) return false
    if (!currentBoard.value.settings.unlockPin.trim()) {
      toast.add({
        title: 'PIN required',
        description: 'Set an unlock PIN in Settings before locking the display.',
        color: 'warning',
        icon: 'i-lucide-lock',
      })
      return false
    }
    updateSettings({ isLocked: true })
    await saveBoard()
    await enterDisplayMode()
    return true
  }

  function unlockDisplay(pin: string): boolean {
    if (!currentBoard.value) return false
    if (pin === currentBoard.value.settings.unlockPin || !currentBoard.value.settings.unlockPin) {
      updateSettings({ isLocked: false })
      void saveBoard()
      void exitDisplayMode()
      return true
    }
    return false
  }

  function requestRecording(durationSeconds: number): void {
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'
        const recorder = new MediaRecorder(stream, { mimeType })
        const chunks: Blob[] = []

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `menu-recording.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`
          a.click()
          URL.revokeObjectURL(url)
          stream.getTracks().forEach(track => track.stop())
        }

        recorder.start()
        await enterDisplayMode(true)
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop()
        }, durationSeconds * 1000)
      } catch {
        toast.add({
          title: 'Recording failed',
          description: 'Screen recording was cancelled or permission was denied.',
          color: 'error',
          icon: 'i-lucide-video-off',
        })
      }
    })()
  }

  return {
    boards,
    currentBoard,
    isLoading: readonly(isLoading),
    isSaving: readonly(isSaving),
    isDirty: readonly(isDirty),
    mode: readonly(mode),
    storageMode,
    loggedIn,
    loadBoards,
    selectBoard,
    newBoard,
    saveBoard,
    removeBoard,
    renameBoard,
    updateSettings,
    setShared,
    addPageFromTemplate,
    addImagePage,
    duplicatePage,
    updatePage,
    removePage,
    movePage,
    generateWithAi,
    activeSortedPages,
    enterDisplayMode,
    exitDisplayMode,
    lockAndStartDisplay,
    unlockDisplay,
    requestRecording,
  }
}
