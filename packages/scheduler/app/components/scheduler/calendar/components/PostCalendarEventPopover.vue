<!--  Translation file -->
<i18n src="./PostCalendarEventPopover.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: the body of a post's event popover.
 *
 * Supplied into `BaseCalendarEventPopover`'s content slot by the shell — the
 * generic popover owns the trigger, the context menu and the pointer guard, so
 * this component renders what a post actually needs inside it: what it is, where
 * it goes, what it will look like on each platform it publishes to, and the two
 * actions that can be taken from here.
 *
 * The platform switcher runs over the post's real targets, not its publish rows:
 * a scheduled post previews what *will* publish, and `platformPosts` describes
 * what already did.
 *
 * The honesty rule is structural. `hasPublished(post)` is the only gate: an
 * unpublished post shows the card and omits every engagement number and comment
 * thread entirely, and a published one shows the real `platformPosts` rows. There
 * is no zero — zero is a number a published post could earn.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { PostCreateBase, PostWithBusinessData } from '#layers/BaseDB/db/schema'
import { usePlatformPreview } from '#layers/BaseScheduler/app/composables/usePlatformPreview'
import { calendarDotClasses } from '#layers/BaseUI/app/composables/useCalendarColors'
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons'
import { platformsForPost } from '../../../../utils/scheduler/posts/targetPlatforms'
import dayjs from 'dayjs'

/** The event this popover always hangs off: a calendar event carrying a post. */
type CalendarEventWithPost = CalendarEvent<PostWithBusinessData>

const { t } = useI18n()
const toast = useToast()
const { specFor, resolvePreview, contentFor, assetsFor, hasPublished, platformStates } = usePlatformPreview()
const { colorFor } = useCalendarPosts()
const { getPlatformIcon, isPlatformSupported } = usePlatformIcons()
const { deletePost } = usePostManager()

const props = defineProps<{
  /** The event this popover hangs off; its `post` is the joined row. */
  event: CalendarEventWithPost
  /** Closes the popover, from the generic component's own slot binding. */
  close?: () => void
}>()

const emit = defineEmits<{
  /** The post changed: the owning view reloads its range and its shared list. */
  refresh: []
  /** Edit was chosen: the shell opens its update modal, which outlives this popover. */
  update: [event: CalendarEventWithPost]
}>()

/** One entry per schema status. A table, so the badge never branches on a name. */
const STATUS_BADGE: Record<string, { color: 'neutral' | 'info' | 'warning' | 'success' | 'error', key: string }> = {
  draft: { color: 'neutral', key: 'statusDraft' },
  pending: { color: 'warning', key: 'statusPending' },
  published: { color: 'success', key: 'statusPublished' },
  failed: { color: 'error', key: 'statusFailed' },
}

const post = computed(() => props.event.post)

const platforms = computed(() => platformsForPost(post.value))

const published = computed(() => hasPublished(post.value))

/** The publish rows as they exist, never attributed to a platform they cannot prove. */
const publishRows = computed(() => (published.value ? platformStates(post.value) : []))

const activePlatform = ref<string | null>(null)
const selectedPlatform = computed(() => {
  return activePlatform.value && platforms.value.includes(activePlatform.value)
    ? activePlatform.value
    : platforms.value[0]!
})

const badgeColor = computed(() => STATUS_BADGE[post.value.status]?.color ?? 'neutral')

const badgeKey = computed(() => STATUS_BADGE[post.value.status]?.key)

/** A status the table has never seen shows the raw value rather than a wrong label. */
const badgeLabel = computed(() => (badgeKey.value ? t(badgeKey.value) : post.value.status))

const businessColor = computed(() => colorFor(post.value))

const scheduledAt = computed(() => post.value.scheduledAt)

const scheduledLabel = computed(() => (scheduledAt.value ? dayjs(scheduledAt.value).format('ddd, MMM D, YYYY · HH:mm') : t('unscheduled')))

const dotClass = computed(() => calendarDotClasses[businessColor.value])

const deleting = ref(false)

function handleClose() {
  props.close?.()
}

/**
 * The edit modal lives on the shell, outside this popover: opening it here
 * and then closing the popover unmounts the modal mid-open, so the edit
 * request goes up and the shell — whose modal survives — opens it.
 */
function handleEdit() {
  handleClose()
  emit('update', props.event)
}

/**
 * The renderers' prop contract.
 *
 * A calendar row already carries everything a renderer reads — content, author,
 * business and publish rows — but `targetPlatforms` and `mediaAssets` are JSON
 * strings on the row where the renderer's arrays live, and `comment` is a
 * per-platform override rather than a field. The row is handed through one
 * boundary conversion here instead of each renderer guessing at the shape.
 */
const renderPost = computed<PostCreateBase>(() => ({
  ...post.value,
  comment: [],
  targetPlatforms: [],
  mediaAssets: [],
}))

const previewComponent = computed(() => resolvePreview(selectedPlatform.value))

const previewContent = computed(() => contentFor(post.value, selectedPlatform.value))

const previewAssets = computed(() => assetsFor(post.value, selectedPlatform.value))

const previewInput = computed(() => ({
  postContent: previewContent.value,
  mediaAssets: previewAssets.value,
  platform: selectedPlatform.value,
  post: renderPost.value,
}))

/**
 * The card's accessible label.
 *
 * `nameSource` is the spec's own statement of whose name the platform puts on
 * the card, so the label describes the same card a sighted reader sees instead
 * of describing the component that renders it.
 */
const previewLabel = computed(() => t('previewLabel', {
  platform: selectedPlatform.value,
  source: specFor(selectedPlatform.value).nameSource,
}))

function iconFor(platform: string): string {
  return getPlatformIcon(isPlatformSupported(platform) ? platform : 'default')
}

function handleSelectPlatform(platform: string) {
  activePlatform.value = platform
}

function handleRefresh() {
  emit('refresh')
}

async function handleConfirmDelete() {
  deleting.value = true

  try {
    await deletePost(post.value.id)
    toast.add({ title: t('postDeleted'), icon: 'i-heroicons-check-circle', color: 'success' })
    handleClose()
    emit('refresh')
  } catch (error) {
    log.error({ message: 'Failed to delete post', postId: post.value.id, error: String(error) })
    toast.add({ title: t('deleteFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
  } finally {
    deleting.value = false
  }
}

function handleDelete() {
  toast.add({
    title: t('deleteTitle'),
    description: t('deleteConfirm'),
    color: 'error',
    actions: [
      { label: t('delete'), color: 'error', variant: 'solid', onClick: handleConfirmDelete },
      { label: t('cancel'), color: 'neutral', variant: 'outline' },
    ],
  })
}
</script>

<template>
  <div class="flex max-h-[28rem] w-72 flex-col gap-3 overflow-y-auto p-1">
    <header class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <UBadge
          variant="subtle"
          size="xs"
          :color="badgeColor"
          class="capitalize"
        >
          {{ badgeLabel }}
        </UBadge>

        <span class="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span class="size-2 shrink-0 rounded-full" :class="dotClass" />
          <span class="truncate">{{ post.business?.name ?? t('unknownBusiness') }}</span>
        </span>
      </div>

      <p class="text-xs text-dimmed">
        {{ scheduledLabel }} · {{ t('formatLabel') }}: {{ post.postFormat ?? 'post' }}
      </p>
    </header>

    <div
      class="flex flex-wrap gap-1"
      role="tablist"
      :aria-label="t('platformsLabel')"
    >
      <UButton
        v-for="platform in platforms"
        :key="platform"
        role="tab"
        size="xs"
        :variant="platform === selectedPlatform ? 'soft' : 'ghost'"
        :icon="iconFor(platform)"
        :aria-selected="platform === selectedPlatform"
        @click="handleSelectPlatform(platform)"
      >
        {{ platform }}
      </UButton>
    </div>

    <div :key="selectedPlatform" v-motion-fade-visible-once :duration="200">
      <component
        :is="previewComponent"
        v-bind="previewInput"
        :aria-label="previewLabel"
      />
    </div>

    <!-- Honesty: what the row actually carries, or an explicit "nothing yet". -->
    <div
      v-if="published"
      v-motion-fade-visible-once
      :duration="200"
      class="rounded-lg border border-default bg-elevated p-2"
    >
      <p class="text-xs font-semibold text-highlighted">{{ t('publishState') }}</p>
      <ul v-if="publishRows.length" class="mt-1 space-y-0.5">
        <li
          v-for="row in publishRows"
          :key="row.id"
          class="flex items-center justify-between gap-2 text-xs text-muted"
        >
          <span class="truncate">{{ row.platformPostId ?? t('unattributedRow') }}</span>
          <span class="shrink-0 tabular-nums">{{ row.status }}</span>
        </li>
      </ul>
      <p v-else class="mt-1 text-xs text-dimmed">{{ t('noPublishRows') }}</p>
    </div>
    <div
      v-else
      v-motion-fade-visible-once
      :duration="200"
      class="rounded-lg border border-dashed border-default bg-elevated p-2"
    >
      <p class="text-xs font-semibold text-highlighted">{{ t('notPublishedTitle') }}</p>
      <p class="mt-1 text-xs text-dimmed">{{ t('notPublishedBody') }}</p>
    </div>

    <footer class="flex items-center justify-end gap-2 border-t border-default pt-2">
      <UButton
        size="xs"
        variant="outline"
        icon="i-lucide-pencil"
        :label="t('edit')"
        @click="handleEdit"
      />

      <UButton
        size="xs"
        variant="outline"
        color="error"
        icon="i-lucide-trash-2"
        :label="t('delete')"
        :loading="deleting"
        @click="handleDelete"
      />
    </footer>
  </div>
</template>
