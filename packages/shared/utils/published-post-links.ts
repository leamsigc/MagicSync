import { parseJsonObject, toJsonString } from './json'

/**
 * Minimal shape of a `platform_posts` row, so both the scheduler and the
 * connect board can read published links without importing DB types.
 */
export interface PublishedLinkSource {
  id: string
  socialAccountId: string
  /** Provider name (e.g. `instagram`), not the external id. */
  platformPostId?: string | null
  status?: string | null
  publishDetail?: unknown
}

export interface PublishedPostLink {
  id: string
  /** Platform label (not an id — `platformPostId` stores the provider name). */
  platform: string
  accountId: string
  status: string
  url: string
}

interface PublishEntry {
  publishedId?: string
  publishedUrl?: string
}

/**
 * Published link for one platform row.
 *
 * Plugins write `publishDetail[socialAccountId] = { publishedId, publishedUrl }`
 * when a post goes live (see `post-batch.service.updatePostBaseOnResponse`), so
 * that map — not `platformPostId` — is the source of truth for "open the post".
 */
export function publishedLinkFor(platform: PublishedLinkSource): PublishedPostLink | null {
  const details = parseJsonObject(toJsonString(platform.publishDetail))
  const entry = details[platform.socialAccountId] as PublishEntry | undefined
  const url = entry?.publishedUrl
  if (!url) return null
  return {
    id: platform.id,
    platform: platform.platformPostId || platform.socialAccountId,
    accountId: platform.socialAccountId,
    status: platform.status || '',
    url,
  }
}

/** Every published link on a post, in platform order. */
export function publishedLinksFor(post: { platformPosts?: PublishedLinkSource[] | null } | null | undefined): PublishedPostLink[] {
  const links: PublishedPostLink[] = []
  for (const platform of post?.platformPosts ?? []) {
    const link = publishedLinkFor(platform)
    if (link) links.push(link)
  }
  return links
}
