<!--  Translation file -->
<i18n src="./PostPreviewShell.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: shared card chrome every platform preview wraps.
 *
 * Owns everything that is identical across the 22 cards — avatar, display name,
 * handle, timestamp, verification badge, platform wordmark — and takes those
 * decisions from the platform's spec rather than branching on the platform
 * name. A renderer supplies the platform-specific pieces through the default
 * slot (the caption body, `PostPreviewContent`) and `#media`, `#actions`,
 * `#comments` and `#extra`; `#extra` also receives the resolved
 * `display-name`, which the Instagram and TikTok cards render as the bold
 * byline before the caption.
 *
 * Two honesty rules live here, not in the renderers:
 *
 * - The timestamp comes from `publishedAt ?? scheduledAt` and is never
 *   `new Date()`. A scheduled post shows its scheduled time; with neither
 *   timestamp set, the slot is empty rather than "just now".
 * - The verified badge needs a real verification state, which no row carries,
 *   so it never renders. `spec.verifiedBadge` only says the platform has such a
 *   badge.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PlatformPost, PostWithBusinessData } from '#layers/BaseDB/db/schema'
import type { HandleStyle, PlatformPreviewSpec, TimestampStyle } from './platformPreviewSpecs'
import { usePlatformIcons } from '#layers/BaseUI/app/composables/usePlatformIcons'
import {
  handleSlug,
  hasPublished,
  initialsOf,
  isVerifiedKnown,
  timestampSourceFor
} from '#layers/BaseScheduler/app/composables/usePlatformPreview'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const props = defineProps<{
  /** Platform key the card is drawn for, e.g. `linkedin-page`. */
  platform: string
  /** The joined post row: content, assets, publish state, business, author. */
  post: PostWithBusinessData
  /** The platform's declarative spec. */
  spec: PlatformPreviewSpec
}>()

const { t } = useI18n()
const { getPlatformIcon, isPlatformSupported } = usePlatformIcons()

/** Every timestamp convention, as a table — no branch tree in the component. */
const TIMESTAMP_FORMATTERS: Record<TimestampStyle, (value: dayjs.Dayjs) => string> = {
  relative: (value) => value.fromNow(),
  'absolute-short': (value) => value.format('MMM D, YYYY'),
  'absolute-long': (value) => value.format('MMMM D, YYYY [at] h:mm A'),
}

/**
 * Every handle convention, as a table.
 *
 * No platform host is carried on the post payload, so the instance part of an
 * `at-instance` handle is left off rather than invented — the card shows
 * `@{handle}` until a host column exists to render `@{handle}@{host}` from.
 */
const HANDLE_FORMATTERS: Record<HandleStyle, (slug: string) => string> = {
  'at': (slug) => `@${slug}`,
  'at-instance': (slug) => `@${slug}`,
  'at-instance-slash': (slug) => `/@${slug}`,
  'none': () => '',
}

const published = computed(() => hasPublished(props.post))

const platformStates = computed<PlatformPost[]>(() => props.post.platformPosts ?? [])

const displayName = computed(() => {
  const businessName = props.post.business?.name
  const userName = props.post.user?.name

  return props.spec.nameSource === 'business'
    ? (businessName ?? userName ?? '')
    : (userName ?? businessName ?? '')
})

const avatarSrc = computed(() => props.post.user?.image ?? undefined)

const avatarInitials = computed(() => initialsOf(props.post.business?.name ?? props.post.user?.name ?? ''))

const handle = computed(() => {
  const slug = handleSlug(displayName.value)

  if (!slug) {
    return ''
  }

  return HANDLE_FORMATTERS[props.spec.handle ?? 'none'](slug)
})

const timestampSource = computed(() => timestampSourceFor(props.post))

const timestamp = computed(() => {
  const source = timestampSource.value

  if (!source) {
    return ''
  }

  return TIMESTAMP_FORMATTERS[props.spec.timestamp](dayjs(source))
})

const timestampIso = computed(() => timestampSource.value?.toISOString() ?? '')

const showVerified = computed(() => props.spec.verifiedBadge && isVerifiedKnown(props.post))

const showsComments = computed(() => props.spec.showsComments && published.value)

const platformIcon = computed(() => getPlatformIcon(
  isPlatformSupported(props.platform) ? props.platform : 'default'
))
</script>

<template>
  <article
    class="w-full rounded-xl border border-default bg-elevated p-4 shadow-sm"
    :aria-label="t('cardAria', { platform: platform, business: displayName || platform })"
  >
    <header class="flex items-center gap-3">
      <UAvatar :src="avatarSrc" :text="avatarInitials" :alt="displayName" size="md" />

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1">
          <span class="truncate text-sm font-semibold text-highlighted">{{ displayName }}</span>
          <UIcon
            v-if="showVerified"
            name="i-heroicons-check-badge-solid"
            class="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
        </div>
        <span v-if="handle" class="block truncate text-xs text-dimmed">{{ handle }}</span>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <time v-if="timestamp" :datetime="timestampIso" class="text-xs tabular-nums text-dimmed">{{ timestamp }}</time>
        <Icon :name="platformIcon" class="size-4 text-muted" aria-hidden="true" />
      </div>
    </header>

    <slot />

    <slot name="media" />

    <slot name="extra" :published :platform-states :display-name="displayName" />

    <slot name="actions" />

    <div v-if="showsComments" v-motion-fade-visible-once :duration="200">
      <slot
        name="comments"
        :published
        :platform-states
        :max-comments="spec.maxComments ?? 0"
      />
    </div>
  </article>
</template>
