---
layout: default
title: "MagicSync Status: Platform Availability"
description: "Current operational status for the MagicSync web app, API, scheduler, publishing workers, AI services and content delivery, plus how incidents are handled."
head:
  htmlAttrs:
    lang: en
  meta:
    - name: keywords
      content: "MagicSync status, social media scheduler uptime, service status, API availability, scheduled post failures"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Current operational status for the MagicSync web app, API, scheduler, publishing workers, AI services and content delivery, plus how incidents are handled."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Platform Status"
    description: "Service availability and incident handling"
    headline: "Live Platform Status"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: All Systems
  content: Core services operational
actions:
  - label: Report an Issue
    href: /support
    icon: "lucide:arrow-right"
  - label: Read the Changelog
    href: /changelog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync service status dashboard"
---
#title
Live <span class="gradient-text">Platform Status</span>

#description
The quickest way to tell whether a problem is on our side. During an incident this page is updated first, before support queues fill up.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Managed cloud status

| Service | Status | What it covers |
|---|---|---|
| Web application | Operational | Sign-in, dashboard, calendar, composer |
| Public API | Operational | `/api/v1/*` requests and API-key access |
| Scheduler | Operational | Queued and time-triggered post dispatch |
| Publishing workers | Operational | Delivery to connected social networks |
| AI services | Operational | Caption, hook and repurposing generation |
| Media and uploads | Operational | Asset upload, storage and delivery |
| MCP and agent runtime | Operational | `/mcp` tools, chat sessions and content board runs |

**Last reviewed:** October 2026. The managed cloud targets 99.9% monthly availability for the web app, API and scheduler.

## If a scheduled post did not publish

1. Open the post and read the per-platform error. Most failures come from an expired token, a missing permission or a rejected media format.
2. Reconnect the affected account from the integrations screen.
3. Retry only the failed platform. MagicSync skips platforms that already published, so followers do not see duplicates.

## Self-hosted deployments

If you run the Docker edition, your availability depends on your own infrastructure. Use the health endpoint from your monitoring tool and treat our status page as a reference for upstream social APIs, not as a report on your server.

## How incidents are handled

We classify an incident as **degraded** when publishing is delayed but queued, and **outage** when new posts cannot be queued or delivered. During an outage, support replies prioritise posts that are time-sensitive, and affected schedules are retried automatically once the dependency recovers.

</section>

::BaseFaq
---
list:
  - label: Does this page monitor my self-hosted instance?
    content: No. It reports the managed MagicSync cloud. Your self-hosted instance has its own logs and health checks.
    value: '1'
  - label: How often is the status updated?
    content: At the start and end of every incident, and at least every 30 minutes while an incident is active.
    value: '2'
  - label: Will missed posts publish automatically after an outage?
    content: Queued posts are retried once the dependency recovers. Posts whose scheduled window has fully passed are flagged for review instead of publishing hours late.
    value: '3'
  - label: Where do I report a problem not listed here?
    content: Send it through the support page with the post ID, platform and approximate time. That lets us correlate it with server logs quickly.
    value: '4'
---

#title
Status FAQ
#subtitle
How to read this page and what to do when something looks wrong.
::

::BaseCallToAction
---
title: Still Seeing a Problem?
description: Send us the post ID and platform. We will trace it against the publishing logs.
primaryAction:
  label: Contact Support
  href: /support
secondaryAction:
  label: Read the Guides
  href: /guides
---
::
