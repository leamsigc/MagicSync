/**
 * Shared helpers the preview system reads a post through.
 *
 * Four rules this module encodes so no renderer has to re-decide them:
 *
 * 1. Content prefers the platform's own override and falls back to the post
 *    body — never the other way round.
 * 2. Media is capped by `platformConfigurations[platform].maxImages`, so a
 *    platform that cannot carry four images never previews four.
 * 3. An unpublished post has no engagement and no comment thread. `hasPublished`
 *    is the gate every spec-driven component consults before rendering a count
 *    or a comment; there is no "looks like zero" fallback, because zero is a
 *    real number a published post could earn.
 * 4. Nothing is invented. Where a field does not exist on the row — a social
 *    handle, a platform host, a verification state, a per-platform publish row
 *    — the helpers say so and the card renders without it instead of making one
 *    up.
 * 5. A renderer's props are typed `PostCreateBase`, which carries no joined
 *    `user`, `business`, `assets` or `platformPosts`. `previewPostFor` shapes
 *    the shell's richer view from them without inventing the gaps: a missing
 *    author renders as an empty name, a missing avatar image renders as
 *    initials, a missing publish row renders as no comment thread.
 *
 * The helpers are module-level and pure; `usePlatformPreview` is the namespace
 * a component destructures.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [✔] Update the typescript.
 */
import type { ComputedRef } from 'vue'
import type { Asset, PlatformPost, PostCreateBase, PostWithBusinessData, User } from '#layers/BaseDB/db/schema'
import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants'
import type { PlatformPreviewKey, PlatformPreviewSpec } from '../components/scheduler/posts/previews/platformPreviewSpecs'
import { hasPreviewSpec, platformPreviewSpecs } from '../components/scheduler/posts/previews/platformPreviewSpecs'
import { previewRegistry, resolvePreviewComponent } from '../components/scheduler/posts/previews/previewRegistry'

/** Matches the first URL in a caption, for Discord-style embed previews. */
const LINK_PATTERN = /https?:\/\/[^\s]+/

/** Everything a card needs to decide which of the two honest modes to draw. */
export interface PreviewPublishState {
  /** The spec this platform's card is drawn from. */
  spec: PlatformPreviewSpec
  /**
   * True only for a post that actually published. False renders structural
   * chrome with no counts and no comments; true renders whatever real
   * per-platform state the row carries.
   */
  published: boolean
  /**
   * The real per-account publish rows, when they exist.
   *
   * `platformPosts` has no platform column — the platform hangs off
   * `socialMediaAccounts` — so this list is NOT keyed by platform. A renderer
   * shows these rows as the history that exists and never attributes one to a
   * platform tab it cannot prove.
   */
  platformStates: PlatformPost[]
}

/**
 * Lower-case handle slug derived from a display name.
 *
 * No handle column exists anywhere in the schema, so the card derives the
 * closest real thing — the name it already has — instead of inventing a
 * username. The platform host that a real `@user@host` handle needs is not on
 * the row either, which is why `at-instance` specs render `@user` alone.
 */
export function handleSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/**
 * Up to two initials for the avatar fallback. The business name is the
 * reliable one: `post.business` is always joined, `post.user` can be absent
 * from an older payload.
 */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

/**
 * True only when the row actually carries a verification state.
 *
 * It does not: `posts`, `user` and `platformPosts` have no verification field.
 * A spec's `verifiedBadge` says the platform *can* show a badge, never that
 * this row is verified, so this stays false until such a field lands.
 */
export function isVerifiedKnown(_post: PostWithBusinessData): boolean {
  return false
}

/** `draft`, `pending` and `failed` have all published nothing. */
export function hasPublished(post: PostWithBusinessData): boolean {
  return post.status === 'published'
}

export function platformStates(post: PostWithBusinessData): PlatformPost[] {
  return post.platformPosts ?? []
}

/**
 * `publishedAt ?? scheduledAt`. Never `new Date()`: a scheduled post must show
 * its scheduled time, and a row with neither shows no timestamp at all rather
 * than "just now".
 *
 * Always a real `Date`: rows arrive over JSON with ISO strings where Drizzle
 * declares timestamps, and a string has no `toISOString` — the shell's `<time>`
 * crashed every preview until this normalized.
 */
export function timestampSourceFor(post: PostWithBusinessData): Date | null {
  const source = post.publishedAt ?? post.scheduledAt ?? null

  if (!source) {
    return null
  }

  const parsed = source instanceof Date ? source : new Date(source)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function maxImagesFor(platform: string): number {
  const config = platformConfigurations[platform] ?? platformConfigurations.default

  return config.maxImages
}

export function specFor(platform: string): PlatformPreviewSpec {
  const key: PlatformPreviewKey = hasPreviewSpec(platform) ? platform : 'default'

  return platformPreviewSpecs[key]
}

export function contentFor(post: PostWithBusinessData, platform: string): string {
  return post.platformContent?.[platform]?.content ?? post.content
}

export function assetsFor(post: PostWithBusinessData, platform: string): Asset[] {
  const assets = post.assets ?? []
  const max = maxImagesFor(platform)

  return max > 0 ? assets.slice(0, max) : []
}

export function isPreviewable(platform: string): boolean {
  return platform in previewRegistry
}

export function previewStateFor(post: PostWithBusinessData, platform: string): PreviewPublishState {
  return {
    spec: specFor(platform),
    published: hasPublished(post),
    platformStates: platformStates(post),
  }
}

/**
 * Shape the shell's `PostWithBusinessData` prop from the renderer props.
 *
 * The post modal and the calendar popover both hand renderers a
 * `PostCreateBase`-shaped row: content, assets and status, but no joined
 * author, business or publish rows. Those are read through the row when a
 * caller supplies them and left `null`/`undefined` otherwise — the shell
 * renders the gap as an empty name and initial-only avatar rather than filling
 * it with a placeholder person. `publishedAt` stays `null` so the timestamp
 * falls back to `scheduledAt` instead of the wall clock.
 */
export function previewPostFor(
  post: PostCreateBase,
  mediaAssets: Asset[],
  fallbackUser?: User | null
): PostWithBusinessData {
  const row = post as PostCreateBase & PostWithBusinessData

  return {
    ...row,
    publishedAt: row.publishedAt ?? null,
    assets: mediaAssets,
    platformPosts: row.platformPosts ?? [],
    user: (row.user ?? fallbackUser) as User,
    business: row.business as { id: string; name: string },
  }
}

/** The renderer-facing prop contract, exactly as the registry passes it. */
export interface PreviewRendererInput {
  postContent: string
  mediaAssets: Asset[]
  platform: string
  post: PostCreateBase
}

/** Everything a spec-driven renderer reads, resolved once from its props. */
export interface PreviewView {
  /** The platform's spec; every branch decision lives here. */
  spec: PlatformPreviewSpec
  /** The shell-shaped post, gaps left empty. */
  post: PostWithBusinessData
  /** `platformContent[platform].content ?? postContent`. */
  content: string
  /**
   * The row's media, uncapped. `PostPreviewMedia` applies the platform's
   * `maxImages` — that is where the cap lives, so the card can also badge the
   * count it dropped. Capping here as well would make that badge unreachable.
   */
  assets: Asset[]
  /** Real comment texts on the row, platform override first. */
  comments: string[]
  /** `comments.length` — the only engagement count that exists on a row. */
  commentCount: number
  /** True only for a row that actually published. */
  published: boolean
}

/**
 * Resolve one renderer's whole view from its props.
 *
 * Content prefers the platform's own override, and comments come from the row
 * — the same rules the shell enforces elsewhere, so no renderer re-decides
 * them. Media travels uncapped: `PostPreviewMedia` owns the `maxImages` cap so
 * the dropped count can render as its `+N` badge.
 */
export function previewViewFor(
  input: PreviewRendererInput,
  fallbackUser?: User | null
): PreviewView {
  const post = previewPostFor(input.post, input.mediaAssets, fallbackUser)
  const override = input.post.platformContent?.[input.platform]
  const comments = override?.comments ?? input.post.comment ?? []

  return {
    spec: specFor(input.platform),
    post,
    content: override?.content ?? input.postContent,
    assets: input.mediaAssets,
    comments,
    commentCount: comments.length,
    published: hasPublished(post),
  }
}

/**
 * Setup-time wrapper a renderer calls once.
 *
 * The logged-in user is the post's author in practice and is real data, not a
 * placeholder — it is the name/avatar fallback the per-platform previews read
 * from `useState('auth:user')` before the shell existed.
 */
export function usePreviewPost(input: PreviewRendererInput): ComputedRef<PreviewView> {
  const fallbackUser = useState<User | null>('auth:user')

  return computed(() => previewViewFor(input, fallbackUser.value))
}

/** Words-per-minute convention the two article cards share. */
export function readingMinutesFor(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length

  return Math.max(1, Math.round(words / 200))
}

/** The first URL in a caption with its host, or two empty strings. */
export function linkPreviewFor(content: string): { url: string; host: string } {
  const url = content.match(LINK_PATTERN)?.[0] ?? ''
  const host = url.replace(/^https?:\/\//, '').split('/')[0]

  return { url, host }
}

export const usePlatformPreview = () => ({
  specFor,
  resolvePreview: resolvePreviewComponent,
  contentFor,
  assetsFor,
  isPreviewable,
  maxImagesFor,
  hasPublished,
  platformStates,
  timestampSourceFor,
  previewStateFor,
  handleSlug,
  initialsOf,
  isVerifiedKnown,
  previewPostFor,
  previewViewFor,
  usePreviewPost,
  readingMinutesFor,
  linkPreviewFor,
})
