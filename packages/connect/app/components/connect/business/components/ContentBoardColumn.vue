<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import ContentBoardCard from './ContentBoardCard.vue'
import { canMoveTo, columnForState, type ContentColumnKey, type ContentItemView } from '../../../../composables/useContentEditor'

/**
 * One board column: its name, its count, and the drop surface for the cards that
 * belong to it.
 *
 * A column only accepts a card the state machine will actually accept. While a
 * card is being dragged the columns that cannot take it stay visibly inert, so
 * the owner learns the rule by seeing it rather than by being told afterwards
 * that the drop was invalid.
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
}>()

const { t } = useI18n()

const over = ref(false)

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
    class="flex min-w-0 flex-1 basis-0 flex-col"
    :data-testid="`board-column-${column}`"
  >
    <header class="flex items-center gap-2 px-3 py-2.5 text-highlighted">
      <h2 class="truncate text-sm font-medium text-highlighted">
        {{ t(`board.columns.${column}`) }}
        <span class="text-muted">({{ items.length }})</span>
      </h2>
    </header>

    <div
      class="mx-2 mb-2 flex min-h-24 flex-1 flex-col overflow-y-auto rounded-lg border border-default transition-colors"
      :class="showTarget ? 'border-primary bg-primary/5' : (refuses ? 'opacity-40' : '')"
      :data-testid="`board-dropzone-${column}`"
      @dragenter="handleDragEnter"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <ContentBoardCard
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :column="column"
        :busy="busyId === item.id"
        :target-url="targetUrl"
        :class="index > 0 ? 'border-t border-default' : ''"
        @open="handleOpen"
        @edit="handleEdit"
        @edit-meta="handleEditMeta"
        @remove="handleRemove"
        @write="handleWrite"
        @move="handleMove"
        @pickup="handlePickup"
        @release="handleRelease"
      />

      <p v-if="items.length === 0" v-motion-fade :duration="200" class="flex items-center gap-2 px-3 py-2.5 text-xs text-muted" :data-testid="`board-empty-${column}`">
        <UIcon name="i-heroicons-circle" class="size-3.5" />
        {{ t('board.empty') }}
      </p>
    </div>
  </section>
</template>