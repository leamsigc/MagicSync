---
name: seo-og
description: Fixing Open Graph / link previews on Nuxt Content + nuxt-og-image pages
triggers:
  - "open graph"
  - "og:image"
  - "link preview"
  - "twitter card"
edges:
  - target: context/stack.md
    condition: when checking @nuxtjs/seo module wiring
last_updated: 2026-09-07
---

# SEO / Open Graph Fixes

## Context

`@nuxtjs/seo` (site.url, sitemap, robots, ogImage) + `@nuxt/content`
(frontmatter `seo`, `ogImage:` block) + `nuxt-og-image` (`defineOgImage`)
own all meta tags. Hand-written tags fight the pipeline.

## Rules

1. NEVER hand-write `og:*` with `name=` — scrapers require
   `property="og:*"`. Never use relative image URLs in meta — scrapers need
   absolute. Never hand-write `twitter:card/title/description/image` in
   markdown `head.meta` — the module infers them from OG (manual copies log
   `[unhead] twitter:card is deprecated` on every page view).
2. `BlogOgImage` props are `title/description/headline/imageUrl`. Markdown
   `ogImage.props` historically passes `image` and omits text — normalize in
   the page (`packages/content/app/pages/[...slug].vue`): explicit props win,
   page title/description/category fill gaps, drop the legacy `image` key so
   it isn't encoded into the OG URL.
3. Blog routes get `ogType: 'article'` + `articlePublishedTime`, not `website`.
4. Verify via SSR HTML (`curl` the route, grep `og:image|og:type|twitter:`):
   exactly one absolute `og:image`, correct title/desc, and fetch the image
   URL (must 200 as PNG). Check the browser console for unhead warnings.
