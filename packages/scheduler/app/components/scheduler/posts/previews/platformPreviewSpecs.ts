/**
 * Declarative per-platform preview specs.
 *
 * One entry per key of `platformConfigurations`. Every renderer reads its spec
 * instead of branching on the platform name, which is what keeps the 22 cards
 * small enough to audit: the platform-specific facts live here, once, and the
 * components only decide how to draw them.
 *
 * Fields with a counterpart in `platformConstants` are derived from it rather
 * than re-typed, so the config table stays the single source of truth:
 * `showsComments` ← `supportsComments`, `linkPreview` ← `supportsLinkPreviews`,
 * `singleAspect` ← `mediaConstraints.aspectRatios.recommended[0]`.
 *
 * The remaining fields are platform behaviour that has no column anywhere:
 * `nameSource`, `handle`, `timestamp`, `mediaLayouts`, `actions`,
 * `verifiedBadge` and `maxComments`. Those are hand-authored from each
 * platform's real card and flagged in a comment wherever the layout is a
 * judgement call rather than something certain.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the module
 * @todo [✔] Update the typescript.
 */
import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants'

/** How the post's media block is laid out for a given asset count. */
export type MediaLayout = 'none' | 'single' | 'grid-2' | 'grid-3' | 'grid-4' | 'carousel' | 'video'

/** How the platform renders the author handle next to the display name. */
export type HandleStyle = 'at' | 'at-instance' | 'at-instance-slash' | 'none'

/** Timestamp convention the shell formats with. */
export type TimestampStyle = 'relative' | 'absolute-short' | 'absolute-long'

/** One entry of the platform's action bar. */
export interface PreviewAction {
  /** Key resolved under `actions` in the renderer's locale file. */
  key: string
  /** `lucide:*` icon name. */
  icon: string
}

/** Media layout per asset count bucket. */
export interface MediaLayouts {
  one: MediaLayout
  two: MediaLayout
  three: MediaLayout
  fourPlus: MediaLayout
}

export interface PlatformPreviewSpec {
  /** How the post's display name renders. */
  nameSource: 'business' | 'user'
  /**
   * Handle format hint the shell renders, e.g. `@{handle}` or
   * `@{handle}@instance`. Omit when the platform shows none.
   */
  handle?: HandleStyle
  /** Timestamp convention. */
  timestamp: TimestampStyle
  /** Media layout for 0/1/2/3/4+ items. */
  mediaLayouts: MediaLayouts
  /** Preferred aspect ratio for single media, from platformConstants. */
  singleAspect?: string
  /** Action bar entries, in platform order. */
  actions: PreviewAction[]
  /** Whether a comments section renders below the card. */
  showsComments: boolean
  /** Whether a verified badge is possible on this platform. */
  verifiedBadge: boolean
  /** Whether the platform renders a link-preview card. */
  linkPreview: boolean
  /** Cap on rendered comment rows. */
  maxComments?: number
}

/**
 * Every key of `platformConfigurations`, in the order the config table
 * declares them. The tuple is what makes `platformPreviewSpecs` a checked
 * `Record` instead of a permissive index signature.
 */
const PLATFORM_KEYS = [
  'default',
  'facebook',
  'instagram',
  'instagram-standalone',
  'twitter',
  'x',
  'google',
  'email-password',
  'linkedin',
  'linkedin-page',
  'tiktok',
  'threads',
  'youtube',
  'pinterest',
  'mastodon',
  'bluesky',
  'reddit',
  'discord',
  'dribbble',
  'devto',
  'wordpress',
] as const

export type PlatformPreviewKey = (typeof PLATFORM_KEYS)[number]

/** A spec before the fields that come from `platformConstants` are folded in. */
type SpecSeed = Omit<PlatformPreviewSpec, 'showsComments' | 'linkPreview' | 'singleAspect'>

/** Feed cards that tile their attachments into a grid. */
const GRID_LAYOUTS: MediaLayouts = { one: 'single', two: 'grid-2', three: 'grid-3', fourPlus: 'grid-4' }

/** Feed cards that paginate attachments with a counter and dots. */
const CAROUSEL_LAYOUTS: MediaLayouts = { one: 'single', two: 'carousel', three: 'carousel', fourPlus: 'carousel' }

/** One media item, full width, never paged. */
const SINGLE_LAYOUTS: MediaLayouts = { one: 'single', two: 'single', three: 'single', fourPlus: 'single' }

/** Video-first card: the first item is the player, extras page behind it. */
const VIDEO_LAYOUTS: MediaLayouts = { one: 'video', two: 'carousel', three: 'carousel', fourPlus: 'carousel' }

/** The card never renders an image at all. */
const NO_MEDIA_LAYOUTS: MediaLayouts = { one: 'none', two: 'none', three: 'none', fourPlus: 'none' }

/** Action-bar entries reused across platforms; icons differ, labels do not. */
const ACTIONS = {
  like: { key: 'like', icon: 'lucide:thumbs-up' },
  heart: { key: 'like', icon: 'lucide:heart' },
  comment: { key: 'comment', icon: 'lucide:message-circle' },
  reply: { key: 'reply', icon: 'lucide:message-circle' },
  repost: { key: 'repost', icon: 'lucide:repeat-2' },
  boost: { key: 'boost', icon: 'lucide:rocket' },
  favorite: { key: 'favorite', icon: 'lucide:star' },
  share: { key: 'share', icon: 'lucide:share-2' },
  send: { key: 'send', icon: 'lucide:send' },
  bookmark: { key: 'bookmark', icon: 'lucide:bookmark' },
  save: { key: 'save', icon: 'lucide:bookmark' },
  upvote: { key: 'upvote', icon: 'lucide:arrow-big-up' },
  downvote: { key: 'downvote', icon: 'lucide:arrow-big-down' },
  react: { key: 'react', icon: 'lucide:smile' },
  unicorn: { key: 'unicorn', icon: 'lucide:sparkles' },
} as const

const SEEDS: Record<PlatformPreviewKey, SpecSeed> = {
  default: {
    nameSource: 'business',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [ACTIONS.like, ACTIONS.comment, ACTIONS.share],
    verifiedBadge: false,
    maxComments: 2,
  },
  // Facebook page card: page name, grid of attachments, Like/Comment/Share,
  // and "Most relevant" comment thread.
  facebook: {
    nameSource: 'business',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [ACTIONS.like, ACTIONS.comment, ACTIONS.share],
    verifiedBadge: true,
    maxComments: 2,
  },
  // Instagram feed card: account handle, carousel with a page counter, the
  // four-button rail, and a comment thread under the caption.
  instagram: {
    nameSource: 'user',
    timestamp: 'relative',
    mediaLayouts: CAROUSEL_LAYOUTS,
    actions: [ACTIONS.heart, ACTIONS.comment, ACTIONS.share, ACTIONS.save],
    verifiedBadge: true,
    maxComments: 2,
  },
  // Legacy Basic Display: no Comments API and no verification concept, so it
  // renders the feed chrome without either.
  'instagram-standalone': {
    nameSource: 'user',
    timestamp: 'relative',
    mediaLayouts: CAROUSEL_LAYOUTS,
    actions: [ACTIONS.heart, ACTIONS.comment, ACTIONS.share],
    verifiedBadge: false,
    maxComments: 0,
  },
  // X renders its attachments stacked in one column with no carousel chrome.
  // Real X tiles four images into a 2x2 grid; left as `single` here because
  // the layout family is what W6 renders first and the spec stays one column
  // until a renderer proves otherwise.
  twitter: {
    nameSource: 'user',
    handle: 'at',
    timestamp: 'relative',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.reply, ACTIONS.repost, ACTIONS.heart, ACTIONS.bookmark, ACTIONS.share],
    verifiedBadge: true,
    maxComments: 2,
  },
  x: {
    nameSource: 'user',
    handle: 'at',
    timestamp: 'relative',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.reply, ACTIONS.repost, ACTIONS.heart, ACTIONS.bookmark, ACTIONS.share],
    verifiedBadge: true,
    maxComments: 2,
  },
  // Google Business Profile posts carry exactly one photo and no video, and
  // the card has no comment surface.
  google: {
    nameSource: 'business',
    timestamp: 'relative',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.share],
    verifiedBadge: false,
    maxComments: 0,
  },
  // Config placeholder, not a network: no real card exists, so it borrows the
  // generic feed chrome and registers no actions.
  'email-password': {
    nameSource: 'business',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [],
    verifiedBadge: false,
    maxComments: 0,
  },
  linkedin: {
    nameSource: 'user',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [ACTIONS.like, ACTIONS.comment, ACTIONS.repost, ACTIONS.send],
    verifiedBadge: false,
    maxComments: 2,
  },
  // Organization page: the page is the author, the profile is not.
  'linkedin-page': {
    nameSource: 'business',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [ACTIONS.like, ACTIONS.comment, ACTIONS.repost, ACTIONS.send],
    verifiedBadge: false,
    maxComments: 2,
  },
  // TikTok is a 9:16 vertical player; photo posts page behind it.
  tiktok: {
    nameSource: 'user',
    handle: 'at',
    timestamp: 'relative',
    mediaLayouts: VIDEO_LAYOUTS,
    actions: [ACTIONS.heart, ACTIONS.comment, ACTIONS.bookmark, ACTIONS.share],
    verifiedBadge: true,
    maxComments: 3,
  },
  // Threads mirrors Instagram's carousel with a four-button rail.
  threads: {
    nameSource: 'user',
    handle: 'at',
    timestamp: 'relative',
    mediaLayouts: CAROUSEL_LAYOUTS,
    actions: [ACTIONS.heart, ACTIONS.comment, ACTIONS.repost, ACTIONS.share],
    verifiedBadge: true,
    maxComments: 2,
  },
  // A YouTube upload has no feed image at all: the video is the post.
  youtube: {
    nameSource: 'business',
    timestamp: 'absolute-short',
    mediaLayouts: NO_MEDIA_LAYOUTS,
    actions: [ACTIONS.like, ACTIONS.comment, ACTIONS.share, ACTIONS.save],
    verifiedBadge: true,
    maxComments: 3,
  },
  // A Pin is one tall image; the card is the save button.
  pinterest: {
    nameSource: 'user',
    timestamp: 'absolute-short',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.save, ACTIONS.share],
    verifiedBadge: true,
    maxComments: 2,
  },
  // Mastodon tiles up to four attachments and never paginates them.
  mastodon: {
    nameSource: 'user',
    handle: 'at-instance',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [ACTIONS.reply, ACTIONS.boost, ACTIONS.favorite],
    verifiedBadge: false,
    maxComments: 2,
  },
  bluesky: {
    nameSource: 'user',
    handle: 'at-instance',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [ACTIONS.reply, ACTIONS.repost, ACTIONS.heart, ACTIONS.share],
    verifiedBadge: false,
    maxComments: 2,
  },
  // A Reddit post is one attachment plus a vote pair.
  reddit: {
    nameSource: 'user',
    timestamp: 'relative',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.upvote, ACTIONS.downvote, ACTIONS.comment, ACTIONS.share, ACTIONS.save],
    verifiedBadge: false,
    maxComments: 3,
  },
  // Discord embeds stack their attachments; the bar is a message bar.
  discord: {
    nameSource: 'business',
    timestamp: 'relative',
    mediaLayouts: GRID_LAYOUTS,
    actions: [ACTIONS.react, ACTIONS.reply, ACTIONS.share],
    verifiedBadge: false,
    maxComments: 2,
  },
  // A dribbble shot is one image.
  dribbble: {
    nameSource: 'user',
    timestamp: 'absolute-short',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.heart, ACTIONS.save],
    verifiedBadge: true,
    maxComments: 2,
  },
  // A dev.to article carries one cover image; the bar adds the unicorn
  // reaction, which is a dev.to-only affordance.
  devto: {
    nameSource: 'business',
    timestamp: 'absolute-short',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.heart, ACTIONS.comment, ACTIONS.save, ACTIONS.unicorn],
    verifiedBadge: true,
    maxComments: 3,
  },
  // WordPress shows the publish date in full.
  wordpress: {
    nameSource: 'business',
    timestamp: 'absolute-long',
    mediaLayouts: SINGLE_LAYOUTS,
    actions: [ACTIONS.like, ACTIONS.comment, ACTIONS.share],
    verifiedBadge: false,
    maxComments: 3,
  },
}

/**
 * Fold the config-derived fields into a hand-authored seed.
 *
 * `recommended[0]` is the platform's own first-choice ratio, so a spec never
 * restates an aspect ratio the config already owns.
 */
function buildSpec(key: PlatformPreviewKey, seed: SpecSeed): PlatformPreviewSpec {
  const config = platformConfigurations[key]

  return {
    ...seed,
    showsComments: config.supportsComments,
    linkPreview: config.supportsLinkPreviews,
    singleAspect: config.mediaConstraints.aspectRatios.recommended[0],
  }
}

/**
 * The spec table. Keyed by exactly the keys of `platformConfigurations`, so a
 * platform added to the config but not here is a type error, not a silent
 * fallback to `default`.
 */
export const platformPreviewSpecs: Record<PlatformPreviewKey, PlatformPreviewSpec> = Object.fromEntries(
  PLATFORM_KEYS.map((key) => [key, buildSpec(key, SEEDS[key])]),
) as Record<PlatformPreviewKey, PlatformPreviewSpec>

/** True when the platform has a spec of its own rather than falling back. */
export function hasPreviewSpec(platform: string): platform is PlatformPreviewKey {
  return platform in platformPreviewSpecs
}
