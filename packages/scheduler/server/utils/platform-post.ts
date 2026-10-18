import type { PlatformPost, PostWithAllData } from '#layers/BaseDB/db/schema'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'

export interface PlatformPostLookup {
  platform: string
  /** Scope to one account. Required to disambiguate two accounts on one platform. */
  accountId?: string | null
  /** Default true. Set false for routes that also accept pending/failed rows. */
  publishedOnly?: boolean
}

/**
 * Resolve the ONE platform post a request is about.
 *
 * A platform post's identity is `(post, account)`, not `(post, platform)` — a
 * post can target several accounts on the same platform (two Facebook pages),
 * so the platform name alone is ambiguous. The account's `platform` is the
 * authoritative source; `platformPostId` is a legacy denormalised copy of the
 * platform name and is only a fallback for rows whose account no longer exists.
 *
 * Every per-platform-post route (stats, comments, likes, hides, deletes,
 * replies) resolves through here, so the rule lives in exactly one place.
 */
export async function resolvePlatformPost(
  post: PostWithAllData,
  lookup: PlatformPostLookup,
): Promise<PlatformPost | null> {
  const rows = (post.platformPosts ?? []).filter(
    (pp) => lookup.publishedOnly === false || pp.status === 'published',
  )
  const scoped = lookup.accountId ? rows.filter((pp) => pp.socialAccountId === lookup.accountId) : rows
  if (scoped.length === 0) return null
  const accounts = await socialMediaAccountService.getAccountsByIds(scoped.map((pp) => pp.socialAccountId), post.userId)
  const platformByAccount = new Map(accounts.map((account) => [account.id, account.platform]))
  return scoped.find(
    (pp) => (platformByAccount.get(pp.socialAccountId) ?? pp.platformPostId) === lookup.platform,
  ) ?? null
}

/** The account id a request targets, read from a `?accountId=` query param. */
export function accountIdFromQuery(query: Record<string, unknown>): string | null {
  const value = query.accountId
  return typeof value === 'string' && value.length > 0 ? value : null
}
