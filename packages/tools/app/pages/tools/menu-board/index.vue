<script setup lang="ts">
/**
 *
 * Dynamic Menu Board — admin panel.
 *
 * Create signage boards, manage pages (HTML/image), pick templates,
 * rotate them on a TV with lock/PIN support, and share a public URL.
 *
 * Storage:
 * - Logged in  → database (`/api/v1/menu-board`, generic entity_details)
 * - Guest      → IndexedDB on this device
 *
 * @version 0.0.1
 */
import BoardDisplay from './components/BoardDisplay.vue'
import PageEditorModal from './components/PageEditorModal.vue'
import TemplatesModal from './components/TemplatesModal.vue'
import BoardSettingsModal from './components/BoardSettingsModal.vue'
import { exportPagesToPdf, type PdfResolution } from './composables/useMenuBoardExport'
import type { MenuPage } from './types'

const {
  boards,
  currentBoard,
  isLoading,
  isSaving,
  isDirty,
  mode,
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
  activeSortedPages,
  enterDisplayMode,
  exitDisplayMode,
  lockAndStartDisplay,
  unlockDisplay,
  requestRecording,
} = useMenuBoard()

// ---------- modals ----------
const showTemplates = ref(false)
const showSettings = ref(false)
const editingPage = ref<MenuPage | null>(null)

// ---------- share ----------
const isSharing = ref(false)
async function handleShareToggle(): Promise<void> {
  if (!currentBoard.value || storageMode.value !== 'database') return
  isSharing.value = true
  try {
    const nextPublic = !currentBoard.value.isPublic
    const url = await setShared(nextPublic)
    useToast().add({
      title: nextPublic ? 'Shared publicly' : 'Sharing disabled',
      description: nextPublic ? 'Anyone with the link can view this board.' : 'The public link is no longer available.',
      color: nextPublic ? 'success' : 'info',
      icon: nextPublic ? 'i-lucide-link' : 'i-lucide-link-2-off',
    })
    if (url) {
      await navigator.clipboard?.writeText(url).catch(() => {})
    }
  } catch {
    useToast().add({
      title: 'Share failed',
      description: 'Could not update sharing. Please try again.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSharing.value = false
  }
}

// ---------- PDF export ----------
const showPdfModal = ref(false)
const pdfResolution = ref<PdfResolution>('1080p')
const selectedPdfIds = ref<string[]>([])
const isExportingPdf = ref(false)

function openPdfModal(): void {
  selectedPdfIds.value = currentBoard.value?.pages.map(p => p.id) ?? []
  showPdfModal.value = true
}

async function handleExportPdf(): Promise<void> {
  if (!currentBoard.value) return
  isExportingPdf.value = true
  try {
    const pages = currentBoard.value.pages.filter(p => selectedPdfIds.value.includes(p.id))
    const ok = await exportPagesToPdf(pages, pdfResolution.value)
    if (ok) {
      showPdfModal.value = false
    } else {
      useToast().add({
        title: 'PDF export failed',
        description: 'Some pages could not be captured. Try disabling external images or retry.',
        color: 'error',
        icon: 'i-lucide-file-down',
      })
    }
  } finally {
    isExportingPdf.value = false
  }
}

// ---------- video recording ----------
const showVideoModal = ref(false)
const videoDuration = ref(30)

function startRecording(): void {
  showVideoModal.value = false
  requestRecording(Math.max(5, videoDuration.value))
}

// ---------- board management ----------
const deleteConfirmId = ref<string | null>(null)

async function confirmDeleteBoard(): Promise<void> {
  if (!deleteConfirmId.value) return
  await removeBoard(deleteConfirmId.value)
  deleteConfirmId.value = null
}

const orderedPages = computed(() =>
  [...(currentBoard.value?.pages ?? [])].sort((a, b) => a.order - b.order),
)

function handleSavePage(page: MenuPage): void {
  updatePage(page.id, page)
}

onMounted(async () => {
  await loadBoards()
  if (!currentBoard.value && boards.value.length > 0) {
    await selectBoard(boards.value[0].id)
  } else if (!currentBoard.value) {
    await newBoard('My First Board')
  }
})

useHead({
  title: 'Dynamic Menu Board — Free Digital Signage Tool',
  meta: [{ name: 'description', content: 'Create rotating digital menu boards for TVs, preview fullscreen and share a public link.' }],
})

defineOgImage('BlogOgImage', {
  title: 'Dynamic Menu Board',
  description: 'Free digital signage menu board builder for your restaurant TVs',
})
</script>

<template>
  <div class="min-h-screen font-sans bg-background text-foreground">
    <BaseHeader />

    <!-- Display mode takes over the whole viewport -->
    <template v-if="mode === 'display'">
      <ClientOnly>
        <BoardDisplay
:pages="activeSortedPages()" :transition-time="currentBoard?.settings.transitionTime ?? 10"
          :is-locked="currentBoard?.settings.isLocked ?? false" interactive
          :validate-pin="unlockDisplay" @exit="exitDisplayMode" />
      </ClientOnly>
    </template>

    <div v-else class="max-w-6xl mx-auto p-6">
      <header class="mb-8 mt-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div data-testid="menu-board-header">
          <h1 class="text-3xl font-semibold tracking-tight mb-2">Dynamic Menu Board</h1>
          <p class="text-muted-foreground">
            Build rotating signage for your TVs and share it with a public link.
          </p>
          <UBadge
:color="storageMode === 'database' ? 'success' : 'neutral'" variant="subtle" class="mt-2"
            data-testid="storage-mode-badge">
            {{ storageMode === 'database' ? 'Saving to your account' : 'Saved on this device (guest mode)' }}
          </UBadge>
        </div>

        <div class="flex flex-wrap gap-2" data-testid="menu-board-toolbar">
          <UButton
variant="outline" color="neutral" icon="i-lucide-file-down" data-testid="open-pdf-export"
            @click="openPdfModal">PDF</UButton>
          <UButton
variant="outline" color="neutral" icon="i-lucide-video" data-testid="open-video-record"
            @click="() => { showVideoModal = true }">Video</UButton>
          <UPopover v-if="loggedIn" data-testid="board-selector">
            <UButton
variant="outline" color="neutral" icon="i-lucide-layout-grid"
              data-testid="board-selector-button">
              Boards ({{ boards.length }})
            </UButton>
            <template #content>
              <div class="p-2 w-64 max-h-80 overflow-y-auto">
                <button
v-for="board in boards" :key="board.id"
                  class="w-full text-left px-3 py-2 rounded-lg hover:bg-accent flex items-center gap-2"
                  :class="{ 'bg-accent': board.id === currentBoard?.id }"
                  :data-testid="`select-board-${board.name.toLowerCase().replace(/\s+/g, '-')}`"
                  @click="() => { selectBoard(board.id) }">
                  <UIcon name="i-lucide-monitor-play" class="size-4 shrink-0" />
                  <span class="truncate">{{ board.name }}</span>
                  <UBadge v-if="board.isPublic" color="info" variant="subtle" size="sm" class="ml-auto">
                    Public
                  </UBadge>
                </button>
                <USeparator class="my-2" />
                <UButton variant="ghost" block icon="i-lucide-plus" data-testid="new-board" @click="newBoard()">
                  New Board
                </UButton>
              </div>
            </template>
          </UPopover>
          <UButton
variant="outline" color="neutral" icon="i-lucide-settings" data-testid="open-settings"
            @click="() => { showSettings = true }">Settings</UButton>
          <UButton
color="warning" variant="subtle" icon="i-lucide-lock" data-testid="lock-display"
            @click="lockAndStartDisplay()">Lock Display</UButton>
          <UButton icon="i-lucide-monitor-play" data-testid="start-display" @click="enterDisplayMode(true)">
            Start Display
          </UButton>
        </div>
      </header>

      <!-- Current board panel — borderless elevated card per system design -->
      <div v-if="currentBoard" class="bg-elevated rounded-2xl overflow-hidden" data-testid="current-board-panel">
        <div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-border/50">
          <UInput :model-value="currentBoard.name" class="flex-1" data-testid="board-name-input"
            @update:model-value="(e) => renameBoard(String(e))" />
          <div class="flex items-center gap-2">
            <UBadge v-if="isDirty" color="warning" variant="subtle" data-testid="dirty-badge">Unsaved</UBadge>
            <UTooltip text="Save board">
              <UButton :loading="isSaving" icon="i-lucide-save" data-testid="save-board" @click="saveBoard()">
                Save
              </UButton>
            </UTooltip>
            <UTooltip v-if="loggedIn"
              :text="currentBoard.isPublic ? 'Disable public sharing' : 'Share a public read-only link'">
              <UButton :loading="isSharing" :color="currentBoard.isPublic ? 'error' : 'primary'"
                :variant="currentBoard.isPublic ? 'subtle' : 'solid'"
                :icon="currentBoard.isPublic ? 'i-lucide-link-2-off' : 'i-lucide-share-2'"
                data-testid="share-toggle" @click="handleShareToggle">
                {{ currentBoard.isPublic ? 'Unshare' : 'Share' }}
              </UButton>
            </UTooltip>
            <UTooltip v-else text="Log in to save to the cloud and get a public share link">
              <UButton color="neutral" variant="outline" icon="i-lucide-lock" disabled
                data-testid="share-disabled-guest">
                Share
              </UButton>
            </UTooltip>
            <UButton color="error" variant="ghost" icon="i-lucide-trash-2"
              :data-testid="`delete-board-${currentBoard.id}`" @click="() => { deleteConfirmId = currentBoard.id }" />
          </div>
        </div>

        <div class="p-5">
          <div class="flex justify-between items-center mb-3">
            <h2 class="font-semibold" data-testid="pages-count">Pages ({{ orderedPages.length }})</h2>
            <div class="flex gap-2">
              <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-code" data-testid="add-html-page"
                @click="() => { showTemplates = true }">Add HTML</UButton>
              <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-image" data-testid="add-image-page"
                @click="() => { addImagePage(); editingPage = orderedPages[orderedPages.length - 1] ?? null }">
                Add Image
              </UButton>
            </div>
          </div>

          <div v-if="orderedPages.length === 0" class="py-10 text-center text-muted-foreground" data-testid="no-pages">
            No pages yet. Click "Add HTML" to pick a restaurant menu template.
          </div>

          <ul v-else class="flex flex-col gap-1" data-testid="page-list">
            <li v-for="(page, index) in orderedPages" :key="page.id"
              class="px-3 py-3 flex items-center justify-between rounded-xl hover:bg-accent/50 transition-colors"
              :class="{ 'opacity-60': !page.isActive }"
              :data-testid="`page-row-${page.name.toLowerCase().replace(/\s+/g, '-')}`">
              <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="flex flex-col text-muted-foreground">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-chevron-up"
                    :disabled="index === 0" :data-testid="`move-up-${page.id}`" @click="movePage(page.id, -1)" />
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-chevron-down"
                    :disabled="index === orderedPages.length - 1" :data-testid="`move-down-${page.id}`"
                    @click="movePage(page.id, 1)" />
                </div>
                <div class="flex items-center justify-center size-10 rounded-lg bg-muted text-muted-foreground shrink-0">
                  <UIcon :name="page.type === 'html' ? 'i-lucide-code' : 'i-lucide-image'" class="size-5" />
                </div>
                <div class="min-w-0">
                  <h3 class="font-medium truncate">{{ page.name }}</h3>
                  <p class="text-xs text-muted-foreground flex items-center gap-2">
                    <span class="inline-block size-2 rounded-full"
                      :class="page.isActive ? 'bg-success' : 'bg-border'" />
                    {{ page.isActive ? 'Active' : 'Inactive' }} • {{ page.type.toUpperCase() }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <UTooltip text="Duplicate">
                  <UButton variant="ghost" color="neutral" size="sm" icon="i-lucide-copy"
                    :data-testid="`duplicate-${page.id}`" @click="duplicatePage(page.id)" />
                </UTooltip>
                <UTooltip text="Edit">
                  <UButton variant="ghost" color="neutral" size="sm" icon="i-lucide-pencil"
                    :data-testid="`edit-${page.id}`" @click="() => { editingPage = page }" />
                </UTooltip>
                <UTooltip text="Delete">
                  <UButton variant="ghost" color="error" size="sm" icon="i-lucide-trash-2"
                    :data-testid="`remove-${page.id}`" @click="removePage(page.id)" />
                </UTooltip>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div v-else-if="isLoading" class="text-center py-24 text-muted-foreground" data-testid="loading-boards">
        Loading boards...
      </div>

      <!-- Page editor -->
      <PageEditorModal
:open="!!editingPage" :page="editingPage" @save="handleSavePage"
        @update:open="(v) => { if (!v) editingPage = null }" />

      <!-- Template picker -->
      <TemplatesModal v-model:open="showTemplates" @select="addPageFromTemplate" />

      <!-- Settings -->
      <BoardSettingsModal
v-model:open="showSettings" :settings="currentBoard?.settings ?? { transitionTime: 10, isLocked: false, unlockPin: '0000' }"
        @update:settings="updateSettings" />

      <!-- PDF export -->
      <UModal v-model:open="showPdfModal" :ui="{ content: 'max-w-md' }">
        <template #content>
          <div class="p-6 space-y-4" data-testid="pdf-export-modal">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold tracking-tight">Export to PDF</h2>
              <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="() => { showPdfModal = false }" />
            </div>
            <UFormField label="Target TV Resolution">
              <USelect
v-model="pdfResolution" :items="[
                { label: '1080p Full HD (1920x1080)', value: '1080p' },
                { label: '4K UHD (3840x2160)', value: '4k' },
              ]" class="w-full" data-testid="pdf-resolution" />
            </UFormField>
            <fieldset class="max-h-60 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              <label
v-for="page in orderedPages" :key="page.id"
                class="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer">
                <input
v-model="selectedPdfIds" type="checkbox" :value="page.id" class="size-4"
                  :data-testid="`pdf-check-${page.id}`">
                <span class="font-medium">{{ page.name }}</span>
                <span class="ml-auto text-xs uppercase text-muted-foreground">{{ page.type }}</span>
              </label>
            </fieldset>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="() => { showPdfModal = false }">Cancel</UButton>
              <UButton
:loading="isExportingPdf" :disabled="selectedPdfIds.length === 0" icon="i-lucide-file-down"
                data-testid="export-pdf-submit" @click="handleExportPdf">
                Download PDF
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Video recording -->
      <UModal v-model:open="showVideoModal" :ui="{ content: 'max-w-md' }">
        <template #content>
          <div class="p-6 space-y-4" data-testid="video-record-modal">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold tracking-tight">Record Display Video</h2>
              <UButton variant="ghost" color="neutral" icon="i-lucide-x" @click="() => { showVideoModal = false }" />
            </div>
            <p class="text-sm text-muted-foreground">
              Starts display mode and records your screen for the given duration.
              Your browser will ask which screen/tab to record.
            </p>
            <UFormField label="Duration (seconds)">
              <UInput
v-model.number="videoDuration" type="number" :min="5" :max="3600" class="w-full"
                data-testid="video-duration" />
            </UFormField>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="neutral" @click="() => { showVideoModal = false }">Cancel</UButton>
              <UButton color="error" icon="i-lucide-video" data-testid="start-recording" @click="startRecording">
                Start Recording
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Delete board confirm -->
      <UModal :open="!!deleteConfirmId" @update:open="v => !v && (deleteConfirmId = null)">
        <template #content>
          <div class="p-6 text-center space-y-4" data-testid="delete-board-confirm">
            <UIcon name="i-lucide-alert-circle" class="size-12 text-destructive mx-auto" />
            <h3 class="text-xl font-bold">Delete Board?</h3>
            <p class="text-muted-foreground">This will permanently delete the board{{ loggedIn ? '' : ' from this device' }}.</p>
            <div class="flex gap-3">
              <UButton variant="outline" color="neutral" block @click="() => { deleteConfirmId = null }">Cancel</UButton>
              <UButton color="error" block data-testid="confirm-delete-board" @click="confirmDeleteBoard">Delete</UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
