<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import ContentBoardCard from './ContentBoardCard.vue'
import { canMoveTo, columnForState, type ContentColumnKey, type ContentItemView } from '../../../../composables/useContentEditor'

/**
 * One board column: a header with its mark, name and count, the cards that
 * belong to it, and the surface a dragged card lands on.
 *
 * A column that cannot take the card in the air stays visibly inert while a
 * drag is running, so the owner learns the rule by seeing it rather than by
 * being told the drop was invalid.
 *
 * A new card always lands in Planned — that is where the state machine starts —
 * so only that column offers "Add task"; the others keep the same control
 * available from the board header instead of pretending to file elsewhere.
 */

const props = defineProps<{
  column: ContentColumnKey
  items: ContentItemView[]
  /**
   * The card currently in the air, resolved by the page from every board item.
   *
   * A column used to look the dragged card up in its own `items`, which is only
   * ever true for a card already in this column — so a card dragged from Planned
   * was invisible to the Approved column and the drop silently did nothing. The
   * page owns the full list, so the page hands over the card itself.
   */
  draggingItem: ContentItemView | null
  /** Id of the card whose action is running — the board is locked behind it. */
  busyId: string | null
  /** Where a published card's `View →` goes. */
  targetUrl: string
  /** Initials of the signed-in owner, forwarded to every card. */
  viewerInitials?: string
}>()

const emit = defineEmits<{
  open: [item: ContentItemView]
  edit: [item: ContentItemView]
  editMeta: [item: ContentItemView]
  remove: [item: ContentItemView]
  write: [item: ContentItemView]
  move: [item: ContentItemView, column: ContentColumnKey]
  drop: [item: ContentItemView]
  /** A card was dropped somewhere the state machine refuses. */
  refuse: [item: ContentItemView]
  pickup: [item: ContentItemView]
  release: []
  /** A new card; the modal owns capture and always files into Planned. */
  create: []
  /** Ask the page to reload the board. */
  reload: []
}>()

const { t } = useI18n()

const over = ref(false)

const MARK: Record<ContentColumnKey, string> = {
  planned: 'i-heroicons-light-bulb',
  approved: 'i-heroicons-eye',
  writing: 'i-heroicons-pencil-square',
  published: 'i-heroicons-check-badge',
}

const MARK_TONE: Record<ContentColumnKey, string> = {
  planned: 'bg-muted text-muted',
  approved: 'bg-info/15 text-info',
  writing: 'bg-warning/15 text-warning',
  published: 'bg-success/15 text-success',
}

/** New cards start in Planned, so that column is the only one that files. */
const canCreate = computed(() => props.column === 'planned')

const dragging = computed(() => props.draggingItem)

/** A card already in this column cannot be dropped on its own column. */
const accepts = computed(() => {
  if (!dragging.value || props.busyId !== null) return false
  return canMoveTo(dragging.value, props.column)
})

/** While a card is in the air, every other column reads as inert. */
const refuses = computed(() => dragging.value !== null && props.busyId === null && !accepts.value && !isOwnColumn.value)

const isOwnColumn = computed(() => {
  const item = dragging.value
  return item !== null && columnForState(item.state) === props.column
})

const showTarget = computed(() => over.value && accepts.value)

const menuItems = computed(() => [
  { label: t('board.addTask'), icon: 'i-heroicons-plus', onSelect: handleCreate },
  { label: t('board.refresh'), icon: 'i-heroicons-arrow-path', onSelect: handleReload },
])

function handleDragEnter() {
  if (accepts.value) over.value = true
}

function handleDragOver(event: DragEvent) {
  if (!accepts.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  over.value = true
}

function handleDragLeave() {
  over.value = false
}

function handleDrop(event: DragEvent) {
  if (!dragging.value) return
  if (!accepts.value) {
    // Still worth saying: a refused drop is the answer to "why won't it move?"
    emit('refuse', dragging.value)
    return
  }
  event.preventDefault()
  over.value = false
  emit('drop', dragging.value)
}

function handleCreate() {
  emit('create')
}

function handleReload() {
  emit('reload')
}

function handleOpen(item: ContentItemView) {
  emit('open', item)
}

function handleEdit(item: ContentItemView) {
  emit('edit', item)
}

function handleEditMeta(item: ContentItemView) {
  emit('editMeta', item)
}

function handleRemove(item: ContentItemView) {
  emit('remove', item)
}

function handleWrite(item: ContentItemView) {
  emit('write', item)
}

/** Forwards the card and the column the move actually targets. */
function handleMove(item: ContentItemView, column: ContentColumnKey) {
  emit('move', item, column)
}

function handlePickup(item: ContentItemView) {
  emit('pickup', item)
}

function handleRelease() {
  emit('release')
}

watch(() => props.draggingItem, () => {
  over.value = false
})
</script>

<template>
  <section
    v-motion-fade-visible
    :duration="200"
    class="flex w-[17rem] shrink-0 flex-col rounded-2xl border border-default bg-elevated/40 sm:w-auto sm:min-w-0 sm:flex-1 sm:shrink sm:basis-0"
    :data-testid="`board-column-${column}`"
  >
    <header class="flex items-center gap-2 px-3 py-2.5">
      <span class="grid size-5 shrink-0 place-items-center rounded-md" :class="MARK_TONE[column]">
        <UIcon :name="MARK[column]" class="size-3.5" aria-hidden="true" />
      </span>
      <h2 class="truncate text-sm font-semibold text-highlighted">
        {{ t(`board.columns.${column}`) }}
        <span class="font-normal text-muted">{{ items.length }}</span>
      </h2>

      <div class="ml-auto flex shrink-0 items-center gap-0.5">
        <UButton
          size="2xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-plus"
          :aria-label="t('board.addTask')"
          :data-testid="`board-column-add-${column}`"
          @click="handleCreate"
        />
        <UDropdownMenu :items="menuItems" :content="{ class: 'min-w-40' }">
          <UButton
            size="2xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-ellipsis-horizontal"
            :aria-label="t('board.columnMenu')"
            :data-testid="`board-column-menu-${column}`"
          />
        </UDropdownMenu>
      </div>
    </header>

    <div
      class="mx-2 mb-2 flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl p-1 transition-colors"
      :class="showTarget ? 'bg-primary/5 ring-1 ring-primary' : (refuses ? 'opacity-40' : '')"
      :data-testid="`board-dropzone-${column}`"
      @dragenter="handleDragEnter"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <ContentBoardCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        :column="column"
        :busy="busyId === item.id"
        :target-url="targetUrl"
        :viewer-initials="viewerInitials"
        @open="handleOpen"
        @edit="handleEdit"
        @edit-meta="handleEditMeta"
        @remove="handleRemove"
        @write="handleWrite"
        @move="handleMove"
        @pickup="handlePickup"
        @release="handleRelease"
      />

      <p v-if="items.length === 0" v-motion-fade :duration="200" class="flex items-center gap-2 px-2 py-2.5 text-xs text-muted" :data-testid="`board-empty-${column}`">
        <UIcon name="i-heroicons-circle" class="size-3.5" />
        {{ t('board.empty') }}
      </p>
    </div>

    <UButton
      v-if="canCreate"
      variant="ghost"
      color="neutral"
      icon="i-heroicons-plus"
      :label="t('board.addTask')"
      class="mx-2 mb-2 justify-start text-xs text-muted"
      :data-testid="`board-column-add-task-${column}`"
      @click="handleCreate"
    />
  </section>
</template>
