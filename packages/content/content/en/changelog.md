---
layout: default
title: "MagicSync Changelog: Latest Product Updates"
description: "Follow what ships in MagicSync: calendar improvements, content board, billing, security hardening, new integrations and performance work, updated regularly."
head:
  htmlAttrs:
    lang: en
  meta:
    - name: keywords
      content: "MagicSync changelog, social media tool updates, product release notes, MagicSync new features"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Follow what ships in MagicSync: calendar improvements, content board, billing, security hardening, new integrations and performance work, updated regularly."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Changelog"
    description: "Product updates, fixes and improvements"
    headline: "See What's New in MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Changelog
  content: Shipped, not promised
actions:
  - label: Read Release Notes
    href: /release-notes
    icon: "lucide:arrow-right"
  - label: Browse the Blog
    href: /blog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync changelog and release timeline"
---
#title
See What's <span class="gradient-text">New in MagicSync</span>

#description
A running record of meaningful changes: new workflows, security fixes, performance work and integrations. Small copy tweaks stay out; things that affect your day do not.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## October 2026

### Calendar rebuilt on Nuxt UI
Replaced the legacy calendar embed with a native day, week and month calendar. Pending posts can be dragged to reschedule, per-platform previews follow the drop, and calendars are shareable per business.

### Shared collection views
Businesses, integrations and other directories now share one collection system with view switching, search, filtering and sorting. Fewer inconsistent screens, faster navigation.

### Content board, profile and billing
Content cards behave like task cards with status chips, priorities, relative dates and context menus. Billing gained plan, payment and invoice screens backed by Stripe, and the profile page became the single account view.

### Snapchat and dev-null.sh connections
Added Snapchat through an official OAuth provider and a dev-null.sh publishing connection, each with setup guidance.

### Security and API performance
The API now resolves the session once per request, enables a short session cookie cache, hardens outbound fetches against SSRF, encrypts social tokens at rest and adds rate limiting plus stricter security headers.

### YouTube metadata and partial retry
YouTube uploads derive a sensible title and tags from post content, and retrying a failed platform no longer re-publishes the ones that already succeeded.

## September 2026

### Agent platform and content board
The in-process agent runtime, per-business content board, trend scans, SEO/GEO checks and approval-gated publishing moved into the main product.

## August 2026

### Self-hosted deployment
Published the Docker deployment path with a non-root container, documented environment variables and a guided first-run setup.

</section>

::BaseFeatures
---
list:
  - title: Release Cadence
    description: Fixes ship continuously; larger features land in themed waves so documentation and screenshots stay current.
    icon: "lucide:rocket"
  - title: Backward Compatibility
    description: Existing scheduled posts keep publishing when internals change. Deprecations are announced before removal.
    icon: "lucide:shield-check"
  - title: Public Roadmap Signals
    description: Blog posts explain the reasoning behind larger changes, including the trade-offs we accepted.
    icon: "lucide:map"
---
#title
How We Ship
#subtitle
What you can do with MagicSync
#description
A predictable rhythm beats a surprise mega-release nobody can plan around.
::

::BaseCallToAction
---
title: Want the Details Behind a Change?
description: Longer release notes and architecture write-ups live on the blog and documentation site.
primaryAction:
  label: Read Release Notes
  href: /release-notes
secondaryAction:
  label: Browse the Blog
  href: /blog
---
::
