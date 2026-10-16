<i18n src="#site/app/pages/app/business/[id]/content.json"></i18n>
<script setup lang="ts">
import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants'
import {
  cardDate,
  cardDayLabel,
  contentCardCode,
  priorityTier,
  WEEKDAY_KEYS,
  type CardDayLabel,
  type PriorityTier,
} from '../../../../utils/content-card'
import {
  BOARD_COLUMN_ORDER,
  canMoveTo,
  nextLegalColumn,
  type ContentColumnKey,
  type ContentItemView,
} from '../../../../composables/useContentEditor'

/**
 * One board card, drawn like a task card.
 *
 * The row used to be a single line; a card now shows the deliverable and its
 * platforms as chips, the title, and a meta line carrying a short board code, a
 * priority mark, the date the card last moved and an avatar for whoever made it.
 * Everything on the card comes from data the server returned — the code is
 * derived from the row id, the date from the most relevant of the three
 * timestamps, and the avatar from `createdBy`.
 *
 * The card is still the drag handle, and every action the board supports is
 * reachable from the context menu (right-click or the `…`) and, for keyboard
 * users, from the hover controls.
 */

const props = defineProps<{
  item: ContentItemView
  column: ContentColumnKey
  /** The card whose action is running — it shows the busy state. */
  busy: boolean
  targetUrl: string
  /** Initials of the signed-in owner, shown on the cards they created. */
  viewerInitials?: string
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

const { t, te, locale } = useI18n()

const route = useRoute()
const toast = useToast()

const menuOpen = ref(false)

const published = computed(() => props.column === 'published')
const needsWrite = computed(() => props.column === 'planned')

const moveLeft = computed(() => nextLegalColumn(props.item, -1))
const moveRight = computed(() => nextLegalColumn(props.item, 1))

const code = computed(() => contentCardCode(props.item.id))
const dayLabel = computed<CardDayLabel | null>(() => cardDayLabel(cardDate(props.item)))
const priority = computed<PriorityTier>(() => priorityTier(props.item.priority))
const platformCount = computed(() => (props.item.platforms ?? []).length)

/** Resolves the relative date chip into the active locale. */
const dayText = computed(() => {
  const label = dayLabel.value
  if (!label) return ''
  if (label.weekday !== undefined) return t(label.key, { day: t(`board.weekday.${WEEKDAY_KEYS[label.weekday]}`) })
  if (label.date) return t(label.key, { date: label.date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' }) })
  return t(label.key)
})

const FORMAT_ICON: Record<string, string> = {
  article: 'i-heroicons-document-text',
  social_post: 'i-heroicons-chat-bubble-left-right',
  carousel: 'i-heroicons-squares-2x2',
  reel: 'i-heroicons-film',
}

const PRIORITY_CLASS: Record<PriorityTier, string> = {
  none: 'text-muted',
  low: 'text-info',
  medium: 'text-primary',
  high: 'text-warning',
  urgent: 'text-error',
}

/** The deliverable chip, or `null` for a card the server stored without a format. */
const formatChip = computed(() => {
  const format = props.item.format
  if (!format) return null
  return { icon: FORMAT_ICON[format] ?? 'i-heroicons-document-text', label: t(`board.format.${format}`) }
})

/** Up to two platform chips; the rest are summarised as a count. */
const platformChips = computed(() => (props.item.platforms ?? []).slice(0, 2).map(platform => ({
  key: platform,
  label: platformLabel(platform),
  color: platformConfigurations[platform]?.color ?? '#6B7280',
})))

/** Brand names are proper nouns, so fall back to the raw id when untranslated. */
function platformLabel(platform: string): string {
  return te(`platforms.${platform}`) ? t(`platforms.${platform}`) : platform
}

const avatarInitials = computed(() => (props.item.createdBy === 'agent' ? 'AI' : (props.viewerInitials || 'ME')))

/** The card's own detail route, shared by the menu's Copy link. */
const detailUrl = computed(() => `/app/business/${route.params.id}/content/${props.item.id}`)

/** Columns the state machine accepts from here, excluding the one we are in. */
const statusTargets = computed(() => BOARD_COLUMN_ORDER
  .filter(column => column !== props.column && canMoveTo(props.item, column)))

const menuItems = computed(() => {
  const writeItems = needsWrite.value
    ? [{ label: t('board.writeNow'), icon: 'i-heroicons-pencil', onSelect: handleWrite }]
    : []
  const statusItem = statusTargets.value.length > 0
    ? [{
        label: t('card.menuStatus'),
        icon: 'i-heroicons-arrow-path-rounded-square',
        children: statusTargets.value.map(column => ({
          label: t(`board.columns.${column}`),
          onSelect: () => handleMoveTo(column),
        })),
      }]
    : []
  return [
    { label: t('card.menuOpen'), icon: 'i-heroicons-arrow-top-right-on-square', onSelect: handleOpen },
    { label: t('card.menuEdit'), icon: 'i-heroicons-pencil-square', onSelect: handleMenuEdit },
    ...writeItems,
    { type: 'separator' as const },
    ...statusItem,
    { label: t('card.menuCopyLink'), icon: 'i-heroicons-link', onSelect: handleCopyLink },
    { type: 'separator' as const },
    { label: t('card.menuDelete'), icon: 'i-heroicons-trash', color: 'error', onSelect: handleMenuRemove },
  ]
})

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

function handleMoveTo(column: ContentColumnKey) {
  emit('move', props.item, column)
}

function handleMoveLeft() {
  if (moveLeft.value) emit('move', props.item, moveLeft.value)
}

function handleMoveRight() {
  if (moveRight.value) emit('move', props.item, moveRight.value)
}

/** Opening the menu from a right-click keeps the trigger out of the way. */
function handleOpenMenu() {
  menuOpen.value = true
}

async function handleCopyLink() {
  try {
    await navigator.clipboard.writeText(detailUrl.value)
    toast.add({ title: t('card.linkCopied'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch {
    toast.add({ title: t('card.linkCopyFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
  }
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
    class="group flex cursor-grab flex-col gap-2 rounded-xl border border-default bg-default p-3 transition-colors hover:border-primary/40 active:cursor-grabbing"
    :class="busy ? 'opacity-70' : ''"
    :aria-busy="busy"
    :data-testid="`board-card-${item.id}`"
    :data-column="column"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @contextmenu.prevent="handleOpenMenu"
  >
    <span class="sr-only" :data-testid="`board-card-handle-${item.id}`" />

    <div class="flex items-start gap-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <span
          v-if="formatChip"
          class="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted"
          :data-testid="`board-card-format-${item.id}`"
        >
          <UIcon :name="formatChip.icon" class="size-3" />
          {{ formatChip.label }}
        </span>
        <span
          v-for="chip in platformChips"
          :key="chip.key"
          class="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted"
        >
          <span class="size-1.5 rounded-full" :style="{ backgroundColor: chip.color }" />
          {{ chip.label }}
        </span>
      </div>

      <span
        class="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
        :title="item.createdBy === 'agent' ? t('card.creatorAgent') : t('card.creatorYou')"
      >
        {{ avatarInitials }}
      </span>
    </div>

    <button
      type="button"
      class="flex w-full items-start gap-1.5 text-left"
      :data-testid="`board-card-open-${item.id}`"
      @click="handleOpen"
    >
      <UIcon v-if="published" name="i-heroicons-check-circle" class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      <span
        class="line-clamp-2 text-sm font-medium"
        :class="published ? 'text-muted line-through' : 'text-highlighted'"
      >
        {{ item.title }}
      </span>
    </button>

    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
      <span class="font-mono tracking-tight">{{ code }}</span>
      <span v-if="priority !== 'none'" class="inline-flex items-center gap-1" :class="PRIORITY_CLASS[priority]">
        <UIcon name="i-heroicons-flag" class="size-3" aria-hidden="true" />
        {{ t(`board.priority.${priority}`) }}
      </span>
      <span v-if="dayLabel" class="inline-flex items-center gap-1">
        <UIcon name="i-heroicons-calendar" class="size-3" aria-hidden="true" />
        {{ dayText }}
      </span>
      <span v-if="platformCount > 2" class="ml-auto">+{{ platformCount - 2 }}</span>
    </div>

    <div v-if="busy" v-motion-fade :duration="150" class="flex items-center gap-1.5 text-[11px] text-muted" data-testid="board-card-busy">
      <UIcon name="i-heroicons-arrow-path" class="size-3.5 animate-spin" />
      {{ t('board.running') }}
    </div>

    <div class="flex items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
      <UButton
        v-if="needsWrite"
        size="2xs"
        variant="soft"
        color="primary"
        icon="i-heroicons-pencil"
        :label="t('board.writeNow')"
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
        :data-testid="`board-card-right-${item.id}`"
        @click="handleMoveRight"
      />

      <UDropdownMenu
        v-model:open="menuOpen"
        :items="menuItems"
        :disabled="busy"
        :content="{ class: 'min-w-44' }"
      >
        <UButton
          size="2xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-ellipsis-horizontal"
          :aria-label="t('card.menu')"
          :disabled="busy"
          :data-testid="`board-card-menu-${item.id}`"
          @click.stop
        />
      </UDropdownMenu>
    </div>
  </div>
</template>
