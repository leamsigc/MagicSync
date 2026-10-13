<!--  Translation file -->
<i18n src="./PostCalendarShell.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: the post calendar's composition point.
 *
 * One component joins the generic Apple grid to everything a post needs: the
 * businesses it draws from, the range it fetches, the filters that narrow it, the
 * drag that moves a post, and the modals that create and edit one. Nothing below
 * this line knows about posts, and nothing above it knows about grids.
 *
 * The template stays thin on purpose. Every decision — what a range request
 * costs, when a business switch re-reads, how a failed drop rolls back — lives in
 * `useCalendarShell`, so each function stays inside the five-branch budget and the
 * markup reads as a list of slots.
 *
 * Slot contract with `BaseCalendarView`:
 *
 * - `#filters` carries the compact filter popover.
 * - `#create` carries the new-post trigger, seeded with the date in view.
 * - `#calendar-list` carries the business list the sidebar renders.
 * - `#event-block` swaps the generic timed block for the post one, so the grid
 *   keeps its geometry, drag and popover while the row inside learns about
 *   status, platforms and content.
 * - `#event-form` is the popover body, which the platform previews live in.
 *
 * The three AI slots are forwarded to both modals exactly as the retired
 * calendar wrapper did: the mic recorder, the template variables and the
 * assistant are one working feature, not two.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 */
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes'
import type { PostCalendarEvent } from '#layers/BaseScheduler/app/composables/useCalendarDragCommit'
import { platformsForPost } from '#layers/BaseScheduler/app/utils/scheduler/posts/targetPlatforms'
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons'
import { isPastDay, pushDrillToFuture } from '#layers/BaseUI/app/utils/calendarDates'
import BusinessCalendarList from './BusinessCalendarList.vue'
import NewCalendarPostModal from '../../posts/components/NewCalendarPostModal.vue'
import PostCalendarEventBlock from './PostCalendarEventBlock.vue'
import PostCalendarEventPopover from './PostCalendarEventPopover.vue'
import PostCalendarFilters from './PostCalendarFilters.vue'
import UpdatePostModal from '../../posts/components/UpdatePostModal.vue'
import { useCalendarShell } from '#layers/BaseScheduler/app/composables/useCalendarShell'

const { t } = useI18n()
const toast = useToast()
const { getPlatformIcon, isPlatformSupported } = usePlatformIcons()

const {
  calendar,
  dragging,
  isEmpty,
  anchorDate,
  reload,
  commit,
  remove,
  applyFilters,
  clearFilters
} = useCalendarShell()

const createModal = ref<InstanceType<typeof NewCalendarPostModal> | null>(null)
const updateModal = ref<InstanceType<typeof UpdatePostModal> | null>(null)

/** The popover hands its event up as a plain calendar event; only a post's is accepted here. */
function asPostEvent(event: CalendarEvent): PostCalendarEvent {
  return event as PostCalendarEvent
}

function handleCreate() {
  createModal.value?.openModal(anchorDate.value)
}

/** The platforms a chip's event publishes to, resolved from its real targets. */
function platformsOf(event: CalendarEvent): string[] {
  return platformsForPost(asPostEvent(event).post)
}

function iconFor(platform: string): string {
  return getPlatformIcon(isPlatformSupported(platform) ? platform : 'default')
}

/**
 * An empty slot was clicked. Only whole past *days* refuse: today stays enabled
 * and opens with the user's time plus five minutes when the drilled instant
 * fell behind (today at 9am, clicked at 8pm), the way the retired FullCalendar
 * wrapper refused past dates but never past hours.
 */
function handleCreateAt(target: Date) {
  if (isPastDay(target)) {
    toast.add({
      title: t('pastTitle', { date: target.toLocaleDateString() }),
      description: t('pastBody'),
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
    return
  }

  createModal.value?.openModal(pushDrillToFuture(target))
}

function handleCommit(event: PostCalendarEvent, start: Date) {
  return commit(event, start)
}

function handleUpdate(event: PostCalendarEvent) {
  updateModal.value?.openModal(event.post)
}

function handleRemove(event: PostCalendarEvent) {
  remove(event.post)
}

function handleApplyFilters(filters: PostFilters) {
  return applyFilters(filters)
}

function handleClearFilters() {
  return clearFilters()
}

function handleRefresh() {
  return reload()
}
</script>

<template>
  <div class="relative flex h-[calc(100dvh-6rem)] min-h-[34rem] flex-col overflow-hidden pr-2">
    <BaseCalendarView :calendar="calendar" @drill="handleCreateAt">
      <template #leading>
        <!-- Long enough that a drop reads as in-flight rather than lost -->
        <UBadge v-if="dragging" v-motion-fade-visible-once :duration="200" color="warning" variant="subtle" size="sm"
          icon="i-lucide-loader" :label="t('saving')" />
      </template>

      <template #filters>
        <PostCalendarFilters @apply="handleApplyFilters" @clear="handleClearFilters" />
      </template>

      <template #create>
        <UButton icon="i-lucide-plus" color="primary" variant="solid" size="sm" class="rounded-full"
          :label="t('newPost')" @click="handleCreate" />
      </template>

      <template #calendar-list>
        <BusinessCalendarList />
      </template>

      <!-- The timed views render the post block instead of the generic one: the
        same drag gesture, the same popover, the row a post actually needs -->
      <template #event-block="{ positioned, anchored, editingId, openEvent, closeEvent }">
        <PostCalendarEventBlock :positioned="positioned" :anchored="anchored" :editing-id="editingId"
          @commit="handleCommit" @update="handleUpdate" @remove="handleRemove" @open="openEvent"
          @close="closeEvent">
          <template #event-form="{ event: formEvent, close }">
            <PostCalendarEventPopover :event="asPostEvent(formEvent)" :close="close" @refresh="handleRefresh"
              @update="handleUpdate" />
          </template>
        </PostCalendarEventBlock>
      </template>

      <!-- The month grid's chips lift the event title straight off the post
        content, and the icon row off its real targets — the compact row the
        retired month grid rendered -->
      <template #event-chip-meta="{ event: chipEvent }">
        <span class="flex shrink-0 items-center">
          <Icon v-for="platform in platformsOf(chipEvent)" :key="platform" :name="iconFor(platform)"
            class="size-3 opacity-80" aria-hidden="true" />
        </span>
      </template>

      <template #event-form="{ event: formEvent, close }">
        <PostCalendarEventPopover :event="asPostEvent(formEvent)" :close="close" @refresh="handleRefresh"
          @update="handleUpdate" />
      </template>
    </BaseCalendarView>

    <!-- Shimmer for the first read of a range; the grid itself keeps its own
      per-day skeletons for the ones after it -->
    <div v-if="calendar.loading.value"
      class="pointer-events-none absolute inset-x-0 top-[calc(var(--ui-header-height)+0.5rem)] z-20 h-1 overflow-hidden"
      v-motion :initial="{ opacity: 0 }" :enter="{ opacity: 1, transition: { duration: 150 } }">
      <USkeleton class="h-full w-full rounded-none" />
    </div>

    <!-- Over the grid but never over it: the wrapper takes no pointer, so a day
      cell stays clickable underneath and only the call to action intercepts -->
    <div v-if="isEmpty" v-motion :initial="{ opacity: 0, y: 8 }"
      :enter="{ opacity: 1, y: 0, transition: { duration: 250 } }"
      class="pointer-events-none absolute inset-0 top-1/3 z-20 flex items-start justify-center pt-24">
      <div
        class="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-default bg-default/90 p-6 text-center shadow-lg backdrop-blur">
        <UIcon name="i-lucide-calendar-plus" class="size-8 text-muted" />
        <p class="text-sm font-semibold text-highlighted">
          {{ t('emptyTitle') }}
        </p>
        <p class="text-xs text-muted">
          {{ t('emptyBody') }}
        </p>
        <UButton icon="i-lucide-plus" size="sm" color="primary" variant="solid" :label="t('emptyAction')"
          @click="handleCreate" />
      </div>
    </div>

    <NewCalendarPostModal ref="createModal" @refresh="handleRefresh">
      <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
        <slot name="mic-recorder" v-bind="slotProps" />
      </template>
      <template v-if="$slots['template-variable']" #template-variable="slotProps">
        <slot name="template-variable" v-bind="slotProps" />
      </template>
      <template v-if="$slots['ai-assistant']" #ai-assistant="slotProps">
        <slot name="ai-assistant" v-bind="slotProps" />
      </template>
    </NewCalendarPostModal>

    <UpdatePostModal ref="updateModal" @refresh="handleRefresh">
      <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
        <slot name="mic-recorder" v-bind="slotProps" />
      </template>
      <template v-if="$slots['template-variable']" #template-variable="slotProps">
        <slot name="template-variable" v-bind="slotProps" />
      </template>
      <template v-if="$slots['ai-assistant']" #ai-assistant="slotProps">
        <slot name="ai-assistant" v-bind="slotProps" />
      </template>
    </UpdatePostModal>
  </div>
</template>
