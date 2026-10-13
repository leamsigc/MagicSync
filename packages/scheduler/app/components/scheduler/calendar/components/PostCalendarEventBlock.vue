<!--  Translation file -->
<i18n src="./PostCalendarEventBlock.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: the post-flavoured event chip inside the timed grids.
 *
 * Rides on `BaseCalendarEventBlock`, which owns the geometry, the pointer
 * gesture and the popover chrome; this component supplies the row that goes
 * inside the chip and nothing else. The whole point is legibility: the old
 * calendar rendered `post.content.slice(0, 15)`, which is unreadable, and
 * `PostCalendarPreview.vue:109` painted a fixed green dot for every status.
 *
 * One row, one line, nothing overflowing: status dot, title, the platform icons
 * the post will publish to, and the scheduled time. The block is painted at
 * `MIN_EVENT_MINUTES` (30 minutes of hour rows) whatever a post's real duration
 * is — a post has one `scheduledAt` and no duration column — so the block is
 * always at least as tall as the drag affordance needs.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { PostWithBusinessData } from '#layers/BaseDB/db/schema'
import type { PositionedEvent } from '#layers/BaseUI/app/utils/calendarLayout'
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons'
import { isReschedulable } from '../../../../utils/scheduler/posts/reschedule'
import { platformsForPost } from '../../../../utils/scheduler/posts/targetPlatforms'
import dayjs from 'dayjs'

const { t } = useI18n()
const { getPlatformIcon, isPlatformSupported } = usePlatformIcons()

const props = withDefaults(defineProps<{
  /** The laid-out event: geometry plus the event itself. */
  positioned: PositionedEvent
  /** The day the popover hangs off, for a block drawn in more than one day. */
  anchored?: boolean
  /** Id of the event whose popover is open, so the form hangs off one day only. */
  editingId?: string
}>(), { anchored: true })

const emit = defineEmits<{
  commit: [event: CalendarEvent<PostWithBusinessData>, start: Date]
  update: [event: CalendarEvent<PostWithBusinessData>]
  remove: [event: CalendarEvent<PostWithBusinessData>]
  open: [id: string]
  close: []
}>()

const event = computed(() => props.positioned.event as CalendarEvent<PostWithBusinessData>)
const post = computed(() => event.value.post)

/** Every platform this post publishes to, resolved from its real targets. */
const platforms = computed(() => platformsForPost(post.value))

/** Only `draft` and `pending` move; the rest refuse with a 409 on the server too. */
const canMove = computed(() => isReschedulable(post.value))

/** Semantic tokens, never a fixed green dot: status is the one fact a chip can be trusted with. */
const STATUS_DOT_CLASSES: Record<string, string> = {
  draft: 'bg-muted',
  pending: 'bg-warning',
  published: 'bg-success',
  failed: 'bg-error',
}

/** An unknown status gets no colour at all rather than a wrong one. */
const UNKNOWN_STATUS_DOT_CLASS = 'border border-default'

const statusDotClass = computed(() => STATUS_DOT_CLASSES[post.value.status] ?? UNKNOWN_STATUS_DOT_CLASS)

/** The scheduled time, from the post's own `scheduledAt` and not the ghost. */
const scheduledTime = computed(() => post.value.scheduledAt ? dayjs(post.value.scheduledAt).format('HH:mm') : '')

function iconFor(platform: string): string {
  return getPlatformIcon(isPlatformSupported(platform) ? platform : 'default')
}

function forwardCommit(committed: CalendarEvent, start: Date) {
  emit('commit', committed as CalendarEvent<PostWithBusinessData>, start)
}

function forwardUpdate(updated: CalendarEvent) {
  emit('update', updated as CalendarEvent<PostWithBusinessData>)
}

function forwardRemove(removed: CalendarEvent) {
  emit('remove', removed as CalendarEvent<PostWithBusinessData>)
}

function forwardOpen(id: string) {
  emit('open', id)
}

function forwardClose() {
  emit('close')
}
</script>

<template>
  <BaseCalendarEventBlock
    :positioned="positioned"
    :anchored="anchored"
    :editing-id="editingId"
    :draggable="canMove"
    @commit="forwardCommit"
    @update="forwardUpdate"
    @remove="forwardRemove"
    @open="forwardOpen"
    @close="forwardClose"
  >
    <template #content>
      <span class="flex w-full min-w-0 items-center gap-1.5">
        <span
          class="size-1.5 shrink-0 rounded-full"
          :class="statusDotClass"
          :aria-label="t('statusLabel', { status: post.status })"
          role="img"
        />

        <span class="min-w-0 flex-1 truncate font-medium">
          {{ post.content }}
        </span>

        <Icon
          v-for="platform in platforms"
          :key="platform"
          :name="iconFor(platform)"
          class="size-3 shrink-0 opacity-80"
          aria-hidden="true"
        />

        <span
          v-if="scheduledTime"
          class="shrink-0 opacity-80 tabular-nums"
        >
          {{ scheduledTime }}
        </span>
      </span>
    </template>

    <template #event-form="{ event: formEvent, close }">
      <slot
        name="event-form"
        :event="formEvent"
        :close="close"
      />
    </template>
  </BaseCalendarEventBlock>
</template>
