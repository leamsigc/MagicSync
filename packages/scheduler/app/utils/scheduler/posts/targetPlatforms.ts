/**
 * Which platforms a post will publish to.
 *
 * `posts.target_platforms` is a JSON *string* of `socialMediaAccounts` ids, not
 * a list of platform names — the composer writes account ids so two accounts on
 * the same network are two separate targets. That is fine for publishing and
 * useless for a preview, which needs a platform key.
 *
 * The account-id → platform-name map is read off the `platformPosts` rows the
 * same create wrote, whose `platformPostId` column carries the platform name
 * (there is no `platform` column on `platform_posts`; the network hangs off
 * `socialMediaAccounts`). `platformPosts` is therefore only ever the *resolver*
 * here, never the list itself: `targetPlatforms` decides what publishes, which
 * is what a scheduled post previews.
 *
 * An entry that resolves to nothing is left as `default` rather than guessed at.
 */

import type { PlatformPost } from '#layers/BaseDB/db/schema'
import { platformConfigurations } from '#layers/BaseShared/shared/platformConstants'

/** The one shape this module needs off a post row. */
export interface PlatformCarrier {
  targetPlatforms: string
  platformPosts?: Pick<PlatformPost, 'socialAccountId' | 'platformPostId'>[] | null
}

/** Every entry in `target_platforms`, tolerating an array or a malformed string. */
export function targetPlatformEntries(post: PlatformCarrier): string[] {
  const raw: unknown = post.targetPlatforms

  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === 'string')
  }

  try {
    const parsed: unknown = JSON.parse(String(raw))

    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

/** account id → platform name, from the publish rows created with the post. */
function platformByAccount(rows: PlatformCarrier['platformPosts']): Map<string, string> {
  const accounts = new Map<string, string>()

  for (const row of rows ?? []) {
    if (row.platformPostId) {
      accounts.set(row.socialAccountId, row.platformPostId)
    }
  }

  return accounts
}

/** True when the string is already a configured platform key. */
function isKnownPlatform(value: string): boolean {
  return value in platformConfigurations
}

/**
 * The platforms this post will publish to, in the order it will publish them,
 * with an unresolvable entry left as `default`.
 *
 * A post with no targets still answers `['default']`: the popover always has a
 * tab and the card always renders, rather than showing nothing and looking
 * broken. Two accounts on the same network resolve to one tab — the card shows
 * a *platform*, so a second Twitter account would render an identical card.
 */
export function platformsForPost(post: PlatformCarrier): string[] {
  const accounts = platformByAccount(post.platformPosts)
  const names = targetPlatformEntries(post)
    .map(entry => accounts.get(entry) ?? (isKnownPlatform(entry) ? entry : 'default'))

  const unique = [...new Set(names)]

  return unique.length > 0 ? unique : ['default']
}
