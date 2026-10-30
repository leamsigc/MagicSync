---
layout: default
title: "Support: Get Help with MagicSync"
description: "Get help with MagicSync: troubleshooting failed posts, account connections, billing and self-hosted deployments. Find the fastest route to an answer."
head:
  htmlAttrs:
    lang: en
  meta:
    - name: keywords
      content: "MagicSync support, social media scheduler help, failed scheduled post, reconnect social account, billing help, self-hosted support"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Get help with MagicSync: troubleshooting failed posts, account connections, billing and self-hosted deployments. Find the fastest route to an answer."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Support"
    description: "Troubleshooting, documentation and direct help"
    headline: "Help When You Need It"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Support
  content: Real answers, not a maze
actions:
  - label: Email Support
    href: mailto:MagicSync@leamsigc.com
    icon: "lucide:mail"
  - label: Check Status
    href: /status
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync support and troubleshooting"
---
#title
Help When You <span class="gradient-text">Need It</span>

#description
Start with the self-serve answers below. If they do not solve it, email us with the post ID, platform and time, and we can trace the exact publishing attempt.
::

::BaseFeatures
---
list:
  - title: Documentation
    description: Setup, connections, scheduling, API and self-hosting guides, all searchable and task-based.
    icon: "lucide:book-open"
  - title: Status Page
    description: Check whether an outage or platform API problem explains the behaviour before you debug your own setup.
    icon: "lucide:activity"
  - title: Guides and Blog
    description: Step-by-step walkthroughs for common workflows, from first-week scheduling to bulk imports and AI repurposing.
    icon: "lucide:newspaper"
  - title: Email Support
    description: For account-specific problems, send the post ID, platform and approximate time so we can correlate server logs.
    icon: "lucide:mail"
---
#title
Find the Fastest Route to an Answer
#subtitle
What you can do with MagicSync
#description
Most issues fall into four buckets. Start with the matching fix.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## A post failed to publish

Open the post and read the per-platform error. The three most common causes are an expired token, a missing permission and an unsupported media format. Reconnect the account from the integrations screen, then retry only the failed platform. Platforms that already published are skipped, so you will not create duplicates.

## An account will not connect

Check that you are signed in to the correct platform profile in the same browser, that the account has the required admin role, and that pop-ups are not blocked during authorization. For Facebook pages and LinkedIn company pages, the personal profile approving access must be an administrator of the page.

## Billing or plan questions

Plan changes, invoices and cancellation live on the [billing page](/app/billing). If a payment succeeded but the plan did not update, include the invoice ID and the email on the account when you contact us.

## Self-hosted deployment issues

Check the container logs and the health endpoint first. Most failed first runs come from missing environment variables, an unmigrated database or a public URL that does not match the configured auth callback.

## What to include in a support email

- The email address on your account.
- The post ID or the account you were connecting.
- The platform and the approximate time in your time zone.
- The exact error text or a screenshot.
- Whether the problem happens every time or only once.

</section>

::BaseFaq
---
list:
  - label: How fast is support?
    content: Pro and Enterprise customers receive priority email support, usually within one business day. Self-hosted users get community support through GitHub.
    value: '1'
  - label: Do you offer phone support?
    content: Email is the primary channel because it keeps the post ID, screenshots and logs in one thread. Enterprise agreements can include scheduled calls.
    value: '2'
  - label: Can you publish a post for me?
    content: We can diagnose why a publish failed, but we do not publish on your behalf. That keeps approval and account control with you.
    value: '3'
  - label: I found a security issue. Where do I report it?
    content: Email us with the subject Security and enough detail to reproduce it. Please do not post exploit details publicly before we respond.
    value: '4'
  - label: Does support cover social platform policy changes?
    content: We explain how MagicSync handles API changes, but platform suspensions and policy decisions remain between you and that platform.
    value: '5'
  - label: Where can I request a feature?
    content: Open an issue on GitHub or send it through support. Include the workflow you are trying to complete, not just the button you want.
    value: '6'
---

#title
Support FAQ
#subtitle
Response times, scope and how to get a useful answer quickly.
::

::BaseCallToAction
---
title: Send Us the Details
description: Post ID, platform and time are enough for us to trace most publishing problems.
primaryAction:
  label: Email Support
  href: mailto:MagicSync@leamsigc.com
secondaryAction:
  label: Read the Docs
  href: /documentation
---
::
