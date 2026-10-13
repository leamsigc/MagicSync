/**
 * Preview registry — the single source of truth for platform → renderer.
 *
 * Replaces the two dispatch tables that could drift (`PhonePreview.vue`'s
 * `switch` and the old `PostCalendarPreview.vue`'s `previewsMap`): both are
 * deleted in W7 and every consumer resolves through here instead.
 *
 * Resolution is a table lookup, never a branch — an unknown key, a missing key
 * and `undefined` all land on `default`. `email-password` points at `default`
 * on purpose: it is a config placeholder, not a network, so there is nothing
 * network-specific to render.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the module
 * @todo [✔] Update the typescript.
 */
import { defineAsyncComponent, type Component } from 'vue'

const FacebookPreview = defineAsyncComponent(() => import('../components/FacebookPreview.vue'))
const InstagramPreview = defineAsyncComponent(() => import('../components/InstagramPreview.vue'))
const InstagramStandalonePreview = defineAsyncComponent(() => import('../components/InstagramStandalonePreview.vue'))
const TwitterPreview = defineAsyncComponent(() => import('../components/TwitterPreview.vue'))
const XPreview = defineAsyncComponent(() => import('../components/XPreview.vue'))
const GooglePreview = defineAsyncComponent(() => import('../components/GooglePreview.vue'))
const LinkedinPreview = defineAsyncComponent(() => import('../components/LinkedinPreview.vue'))
const LinkedInPagePreview = defineAsyncComponent(() => import('../components/LinkedInPagePreview.vue'))
const TiktokPreview = defineAsyncComponent(() => import('../components/TiktokPreview.vue'))
const ThreadsPreview = defineAsyncComponent(() => import('../components/ThreadsPreview.vue'))
const YoutubePreview = defineAsyncComponent(() => import('../components/YoutubePreview.vue'))
const PinterestPreview = defineAsyncComponent(() => import('../components/PinterestPreview.vue'))
const MastodonPreview = defineAsyncComponent(() => import('../components/MastodonPreview.vue'))
const BlueskyPreview = defineAsyncComponent(() => import('../components/BlueskyPreview.vue'))
const RedditPreview = defineAsyncComponent(() => import('../components/RedditPreview.vue'))
const DiscordPreview = defineAsyncComponent(() => import('../components/DiscordPreview.vue'))
const DribbblePreview = defineAsyncComponent(() => import('../components/DribbblePreview.vue'))
const DevtoPreview = defineAsyncComponent(() => import('../components/DevtoPreview.vue'))
const WordpressPreview = defineAsyncComponent(() => import('../components/WordpressPreview.vue'))
const DefaultPreview = defineAsyncComponent(() => import('../components/DefaultPreview.vue'))

/**
 * Platform → renderer component, keyed exactly like `platformPreviewSpecs`.
 *
 * Three keys forward to another platform's card instead of duplicating a
 * template — `instagram-standalone`, `linkedin-page` and `x` — because the
 * spec already encodes their differences. `EmailPasswordPreview.vue` is
 * deliberately not wired: it is a stub that prints "Preview for
 * Email/Password", and `email-password` is a config placeholder rather than a
 * network, so `default` is the honest rendering.
 *
 * @todo [ ] Test the module
 * @todo [✔] Update the typescript.
 */
export const previewRegistry: Record<string, Component> = {
  facebook: FacebookPreview,
  instagram: InstagramPreview,
  'instagram-standalone': InstagramStandalonePreview,
  twitter: TwitterPreview,
  x: XPreview,
  google: GooglePreview,
  'email-password': DefaultPreview,
  linkedin: LinkedinPreview,
  'linkedin-page': LinkedInPagePreview,
  tiktok: TiktokPreview,
  threads: ThreadsPreview,
  youtube: YoutubePreview,
  pinterest: PinterestPreview,
  mastodon: MastodonPreview,
  bluesky: BlueskyPreview,
  reddit: RedditPreview,
  discord: DiscordPreview,
  dribbble: DribbblePreview,
  devto: DevtoPreview,
  wordpress: WordpressPreview,
  default: DefaultPreview,
}

/** Every registry key, for iteration and for the spec/registry parity check. */
export const PREVIEW_PLATFORMS: string[] = Object.keys(previewRegistry)

/**
 * Resolve the renderer for a platform. `undefined`, an unknown key and
 * `email-password` all resolve to the `default` renderer.
 */
export function resolvePreviewComponent(platform: string | undefined): Component {
  if (!platform) {
    return previewRegistry.default as Component
  }

  return previewRegistry[platform] ?? (previewRegistry.default as Component)
}
