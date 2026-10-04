<i18n src="../content.json"></i18n>
<script setup lang="ts">
import ContentBoardColumn from '#layers/BaseConnect/app/components/connect/business/components/ContentBoardColumn.vue'
import ContentBoardMode from '#layers/BaseConnect/app/components/connect/business/components/ContentBoardMode.vue'
import ContentCardDeleteModal from '#layers/BaseConnect/app/components/connect/business/components/ContentCardDeleteModal.vue'
import ContentCardCreateModal from '#layers/BaseConnect/app/components/connect/business/components/ContentCardCreateModal.vue'
import ContentCardEditModal from '#layers/BaseConnect/app/components/connect/business/components/ContentCardEditModal.vue'
import ContentPublishTargets from '#layers/BaseConnect/app/components/connect/business/components/ContentPublishTargets.vue'
import ContentScanModal from '#layers/BaseConnect/app/components/connect/business/components/ContentScanModal.vue'
import { displayAngle } from '#layers/BaseConnect/app/utils/content-brief'
import { contentApiError } from '#layers/BaseConnect/app/utils/content-api-error'
import {
  useContentBoard,
  type ContentColumnKey,
  type ContentItemView,
} from '#layers/BaseConnect/app/composables/useContentEditor'

/**
 * The board (PRD-CONTENT-PIPELINE-OVERHAUL §1.1, and §10 D01–D03 for the dialogs
 * that sit on top of it).
 *
 * **Scan is a dialog** (D01) because the platform choice is the decision: it is a
 * blog post either way, and the platforms only decide which versions come back.
 * The backend persists every idea it returns into Planned, so a scan has no
 * second step — one confirm, the dialog closes, the board reloads.
 *
 * **The card menu** (D02) owns edit and delete; edit sends only the fields the
 * owner changed (D04), and delete asks twice.
 *
 * The server stays the authority: every dialog ends in a reload, so a state the
 * server did not accept is never left on screen.
 */

interface ScannedIdea {
  id: string
  title: string
  brief: string
  platforms?: string[]
  /** Present once the server owns the idea as a Planned row. */
  itemId?: string
}

interface ScanResult {
  ideas?: ScannedIdea[]
}

interface ScanRequest {
  topic: string
  platforms: string[]
}

interface ContentDraft {
  title: string
  brief: string
}

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const businessId = route.params.id as string

const {
  busyId,
  columns,
  items,
  load,
  loadSafeMode,
  loadTargets,
  locked,
  loading,
  moveTo,
  safeMode,
  switchingMode,
  targetId,
  targets,
  targetsLoading,
  targetUrl,
  toggleSafeMode,
} = useContentBoard({ businessId })

const draggingId = ref<string | null>(null)
/** The whole board owns the drag, so it resolves the card the columns receive. */
const draggingItem = computed(() => items.value.find(item => item.id === draggingId.value) ?? null)
const scanOpen = ref(false)
const scanning = ref(false)
const editOpen = ref(false)
const editItem = ref<ContentItemView | null>(null)
const savingEdit = ref(false)
const createOpen = ref(false)
const creating = ref(false)
const deleteOpen = ref(false)
const deleteItem = ref<ContentItemView | null>(null)
const deleting = ref(false)

/** Anything in flight locks the board, exactly like a running column action. */
/** The chip shows where a drop on Published would land, or that it is unset. */
const targetLabel = computed(() => {
  const chosen = targets.value.find(target => target.id === targetId.value)
  return chosen?.name ?? t('board.target.unset')
})

const boardLocked = computed(() => locked.value || scanning.value || savingEdit.value || deleting.value || creating.value)

useSeoMeta({
  title: () => t('seo_title'),
  description: () => t('seo_description'),
})

function handleOpenScan() {
  scanOpen.value = true
}

/** A blank topic is not an error — the server then scans the business itself. */
function scanBody(request: ScanRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { businessId, platforms: request.platforms }
  if (request.topic) body.topic = request.topic
  return body
}

/** The scan persists every idea, so an `itemId` is what "added" means. */
function countAdded(ideas: ScannedIdea[]): number {
  const persisted = ideas.filter(idea => Boolean(idea.itemId)).length
  return persisted || ideas.length
}

function notifyScanned(added: number) {
  if (added > 0) {
    toast.add({ title: t('scan.added', { count: added }), icon: 'i-heroicons-check-circle', color: 'success' })
    return
  }
  toast.add({ title: t('ideas.none'), icon: 'i-heroicons-light-bulb', color: 'warning' })
}

async function handleScan(request: ScanRequest) {
  if (scanning.value) return
  scanning.value = true
  try {
    const result = await $fetch<ScanResult>('/api/v1/content/scan', {
      method: 'POST',
      body: scanBody(request),
    })
    scanOpen.value = false
    await load()
    notifyScanned(countAdded(result.ideas ?? []))
  }
  catch (error) {
    toast.add({ title: t('scan.failed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    scanning.value = false
  }
}

function handleOpenCreate() {
  createOpen.value = true
}

/** A card made by hand is a Planned row, exactly like one a scan returns. */
async function handleCreate(draft: ContentDraft) {
  if (creating.value) return
  creating.value = true
  try {
    await $fetch('/api/v1/content-items', {
      method: 'POST',
      body: { businessId, title: draft.title, brief: draft.brief, sourceType: 'manual' },
    })
    createOpen.value = false
    await load()
    toast.add({ title: t('card.created'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('card.createFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    creating.value = false
  }
}

function handleEditMeta(item: ContentItemView) {
  editItem.value = item
  editOpen.value = true
}

/** D04: only what the owner actually changed leaves the browser. */
function changedFields(item: ContentItemView, draft: ContentDraft): Record<string, unknown> {
  const body: Record<string, unknown> = { businessId, itemId: item.id }
  const title = draft.title.trim()
  if (title && title !== item.title) body.title = title
  const brief = draft.brief.trim()
  if (brief !== displayAngle(item.brief)) body.brief = brief
  return body
}

async function handleSaveEdit(draft: ContentDraft) {
  const item = editItem.value
  if (!item || savingEdit.value) return
  savingEdit.value = true
  try {
    await $fetch('/api/v1/content/update', {
      method: 'POST',
      body: changedFields(item, draft),
    })
    editOpen.value = false
    await load()
    toast.add({ title: t('card.saved'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('card.saveFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    savingEdit.value = false
  }
}

function handleAskDelete(item: ContentItemView) {
  deleteItem.value = item
  deleteOpen.value = true
}

async function handleConfirmDelete() {
  const item = deleteItem.value
  if (!item || deleting.value) return
  deleting.value = true
  try {
    await $fetch('/api/v1/content/delete', {
      method: 'POST',
      body: { businessId, itemId: item.id },
    })
    deleteOpen.value = false
    await load()
    toast.add({ title: t('card.deleted'), icon: 'i-heroicons-trash', color: 'success' })
  }
  catch (error) {
    toast.add({ title: t('card.deleteFailed'), description: contentApiError(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

/** Both the drop and the card's move buttons land here; the column decides. */
function handleMove(item: ContentItemView, column: ContentColumnKey) {
  return moveTo(item, column)
}

/** Forward the column a drop landed on; the page owns the `v-for`. */
function handleDrop(column: ContentColumnKey, item: ContentItemView) {
  return moveTo(item, column)
}

/**
 * A card dropped on a column the state machine refuses. Handing it to `moveTo`
 * reuses its one explanation of why, so a refused drop reads the same as a
 * refused button press.
 */
function handleRefuse(column: ContentColumnKey, item: ContentItemView) {
  return moveTo(item, column)
}

/** The quiet `Write now` is the Writing column's action, without the drag. */
function handleWrite(item: ContentItemView) {
  return moveTo(item, 'writing')
}

function handleOpen(item: ContentItemView) {
  router.push(`/app/business/${businessId}/content/${item.id}`)
}

/** `Edit` on a published card lands straight in the idea view's editor. */
function handleEdit(item: ContentItemView) {
  router.push(`/app/business/${businessId}/content/${item.id}?edit=1`)
}

function handlePickup(item: ContentItemView) {
  draggingId.value = item.id
}

function handleRelease() {
  draggingId.value = null
}

function handleBack() {
  router.push('/app/business')
}

onMounted(() => {
  void load()
  void loadSafeMode()
  void loadTargets()
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-default text-highlighted">
    <header class="sticky top-0 z-40 border-b border-default bg-default/95 backdrop-blur-xl">
      <div class="mx-auto flex w-full max-w-[100rem] items-center gap-3 px-4 py-3 lg:px-8">
        <div class="flex min-w-0 items-center gap-2">
          <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" :aria-label="t('back')" @click="handleBack" />
          <h1 class="truncate text-lg font-semibold">
            {{ t('title') }}
          </h1>
          <UPopover :content="{ align: 'start' }">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-paper-airplane"
              class="text-muted"
              :aria-label="t('board.target.label')"
              data-testid="publish-target-chip"
            >
              {{ targetLabel }}
            </UButton>
            <template #content>
              <div class="w-72 p-1">
                <ContentPublishTargets v-model:connection-id="targetId" :targets="targets" :loading="targetsLoading" />
              </div>
            </template>
          </UPopover>
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-2">
          <ContentBoardMode :safe-mode="safeMode" :busy="switchingMode" @toggle="toggleSafeMode" />
          <UButton
            icon="i-heroicons-plus"
            color="neutral"
            variant="outline"
            :label="t('card.create')"
            :disabled="boardLocked"
            data-testid="new-card"
            @click="handleOpenCreate"
          />
          <UButton
            icon="i-heroicons-magnifying-glass"
            color="primary"
            :label="t('scan.submit')"
            :disabled="boardLocked"
            data-testid="find-ideas"
            @click="handleOpenScan"
          />
        </div>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-3 px-4 py-4 lg:px-8">
      <div v-if="loading" v-motion-fade :duration="200" class="flex justify-center py-20" data-testid="board-loading">
        <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin text-muted" />
      </div>

      <div
        v-else
        class="flex min-h-0 flex-1 gap-3 overflow-x-auto transition-opacity"
        :class="boardLocked ? 'pointer-events-none opacity-60' : ''"
        data-testid="content-board"
      >
        <ContentBoardColumn
          v-for="column in columns"
          :key="column.key"
          :column="column.key"
          :items="column.items"
          :dragging-item="draggingItem"
          :busy-id="busyId"
          :target-url="targetUrl"
          @open="handleOpen"
          @edit="handleEdit"
          @edit-meta="handleEditMeta"
          @remove="handleAskDelete"
          @write="handleWrite"
          @move="handleMove"
          @drop="handleDrop(column.key, $event)"
          @refuse="handleRefuse(column.key, $event)"
          @pickup="handlePickup"
          @release="handleRelease"
        />
      </div>
    </main>

    <ContentScanModal v-model:open="scanOpen" :busy="scanning" @scan="handleScan" />
    <ContentCardCreateModal v-model:open="createOpen" :busy="creating" @create="handleCreate" />
    <ContentCardEditModal v-model:open="editOpen" :item="editItem" :busy="savingEdit" @save="handleSaveEdit" />
    <ContentCardDeleteModal v-model:open="deleteOpen" :item="deleteItem" :busy="deleting" @confirm="handleConfirmDelete" />
  </div>
</template>