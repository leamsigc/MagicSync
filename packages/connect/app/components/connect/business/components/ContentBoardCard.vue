<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { nextLegalColumn, type ContentColumnKey, type ContentItemView } from '../../../../composables/useContentEditor'

/**
 * One board card, drawn as a row rather than a box.
 *
 * The column used to hold individual bordered cards, so a board of twelve ideas
 * looked like twelve competing panels and the titles were unreadable. A card is
 * now a row in a single divided list: a state mark, the title, a muted meta
 * line, and one chevron. The column owns the outer border, the rows own the
 * dividers, and nothing nests a box inside another box.
 *
 * The row is the drag handle. The chevron opens the card; the write and move
 * controls appear on hover and on keyboard focus so the resting state stays
 * quiet without taking the keyboard path away.
 */

const props = defineProps<{
  item: ContentItemView
  column: ContentColumnKey
  /** The card whose action is running — it shows the busy state. */
  busy: boolean
  targetUrl: string
}>()

const emit = defineEmits<{
  open: [item: ContentItemView]
  edit: [item: ContentItemView]
  /** The menu's Edit — the title and brief, not the article. */
  editMeta: [item: ContentItemView]
  remove: [item: ContentItemView]
  write: [item: ContentItemView]
  move: [item: ContentItemView, column: ContentColumnKey]
  pickup: [item: ContentItemView]
  release: []
}>()

const { t } = useI18n()

const published = computed(() => props.column === 'published')
const needsWrite = computed(() => props.column === 'planned')

const moveLeft = computed(() => nextLegalColumn(props.item, -1))
const moveRight = computed(() => nextLegalColumn(props.item, 1))

/** Platform marks for the meta line, joined so the row reads as one line. */
const metaLine = computed(() => (props.item.platforms ?? [])
  .slice(0, 3)
  .map(platform => t(`platforms.${platform}`))
  .join(' · '))

const MARK: Record<ContentColumnKey, string> = {
  planned: 'i-heroicons-light-bulb',
  approved: 'i-heroicons-eye',
  writing: 'i-heroicons-pencil-square',
  published: 'i-heroicons-check-badge',
}

const MARK_COLOR: Record<ContentColumnKey, string> = {
  planned: 'text-muted',
  approved: 'text-info',
  writing: 'text-warning',
  published: 'text-success',
}

const menuItems = computed(() => [
  { label: t('card.menuEdit'), icon: 'i-heroicons-pencil-square', onSelect: handleMenuEdit },
  { type: 'separator' as const },
  { label: t('card.menuDelete'), icon: 'i-heroicons-trash', color: 'error', onSelect: handleMenuRemove },
])

function handleOpen() {
  emit('open', props.item)
}

function handleWrite() {
  emit('write', props.item)
}

/** `Edit` on a published card lands straight in the card's editor. */
function handleEdit() {
  emit('edit', props.item)
}

function handleMenuEdit() {
  emit('editMeta', props.item)
}

function handleMenuRemove() {
  emit('remove', props.item)
}

function handleMoveLeft() {
  if (moveLeft.value) emit('move', props.item, moveLeft.value)
}

function handleMoveRight() {
  if (moveRight.value) emit('move', props.item, moveRight.value)
}

function handleDragStart(event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  emit('pickup', props.item)
}

function handleDragEnd() {
  emit('release')
}
</script>

<template>
  <div
    draggable="true"
    class="group flex cursor-grab items-center gap-3 px-3 py-2.5 transition-colors hover:bg-elevated/50 active:cursor-grabbing"
    :class="busy ? 'opacity-70' : ''"
    :aria-busy="busy"
    :data-testid="`board-card-${item.id}`"
    :data-column="column"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <span class="sr-only" :data-testid="`board-card-handle-${item.id}`" />
    <UIcon
      :name="MARK[column]"
      class="size-4 shrink-0"
      :class="MARK_COLOR[column]"
      :aria-hidden="true"
    />

    <div class="min-w-0 flex-1">
      <button
        type="button"
        class="block w-full truncate text-left text-sm font-medium text-highlighted hover:text-primary"
        :data-testid="`board-card-open-${item.id}`"
        @click="handleOpen"
      >
        {{ item.title }}
      </button>

      <p v-if="metaLine" class="truncate text-xs text-muted">
        {{ metaLine }}
      </p>
      <p v-else class="truncate text-xs text-muted">
        {{ t(`board.columns.${column}`) }}
      </p>
    </div>

    <div v-if="busy" v-motion-fade :duration="150" class="flex shrink-0 items-center gap-1.5 text-[11px] text-muted" data-testid="board-card-busy">
      <UIcon name="i-heroicons-arrow-path" class="size-3.5 animate-spin" />
      {{ t('board.running') }}
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      <UButton
        v-if="needsWrite"
        size="2xs"
        variant="soft"
        color="primary"
        icon="i-heroicons-pencil"
        :label="t('board.writeNow')"
        class="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        :disabled="busy"
        :data-testid="`board-card-write-${item.id}`"
        @click="handleWrite"
      />

      <template v-if="published">
        <UButton
          size="2xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-pencil-square"
          :aria-label="t('board.edit')"
          class="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          :data-testid="`board-card-edit-${item.id}`"
          @click="handleEdit"
        />
        <UButton
          v-if="targetUrl"
          size="2xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-arrow-top-right-on-square"
          :aria-label="t('board.view')"
          class="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          :to="targetUrl"
          external
          :data-testid="`board-card-view-${item.id}`"
        />
      </template>

      <UButton
        v-if="moveLeft"
        size="2xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-chevron-left"
        :aria-label="t('board.moveLeft')"
        class="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        :data-testid="`board-card-left-${item.id}`"
        @click="handleMoveLeft"
      />
      <UButton
        v-if="moveRight"
        size="2xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-chevron-right"
        :aria-label="t('board.moveRight')"
        class="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        :data-testid="`board-card-right-${item.id}`"
        @click="handleMoveRight"
      />

      <UDropdownMenu :items="menuItems" :disabled="busy" :content="{ class: 'min-w-40' }">
        <UButton
          size="2xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-ellipsis-horizontal"
          class="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          :aria-label="t('card.menu')"
          :disabled="busy"
          :data-testid="`board-card-menu-${item.id}`"
          @click.stop
        />
      </UDropdownMenu>

      <UButton
        size="2xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-chevron-right"
        :aria-label="t('card.open')"
        :data-testid="`board-card-go-${item.id}`"
        @click="handleOpen"
      />
    </div>
  </div>
</template>