---
layout: default
title: "Documentation: Install, Configure, Extend | MagicSync"
description: "MagicSync documentation for setup, platform connections, scheduling, AI agents, API keys, MCP and self-hosted Docker deployment. Start with the quick start guide."
head:
  htmlAttrs:
    lang: en
  meta:
    - name: keywords
      content: "MagicSync documentation, social media scheduler setup, Docker deployment, self-host social media tool, MCP server, API keys"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "MagicSync documentation for setup, platform connections, scheduling, AI agents, API keys, MCP and self-hosted Docker deployment. Start with the quick start guide."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Documentation"
    description: "Setup, configuration, API and self-hosting guides"
    headline: "Everything You Need to Run MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Documentation
  content: From first login to self-hosting
actions:
  - label: Open the Docs
    href: https://leamsigc.github.io/MagicSync/
    icon: "lucide:arrow-right"
  - label: API Reference
    href: /api-reference
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync documentation site"
---
#title
Everything You Need to <span class="gradient-text">Run MagicSync</span>

#description
Short, task-based guides instead of a wall of reference text. Find the job you need to do, follow the steps, and get back to publishing.
::

::BaseFeatures
---
list:
  - title: Getting Started
    description: Create a workspace, add a business profile and schedule your first post. The guided checklist covers the three setup steps.
    icon: "lucide:rocket"
  - title: Platform Connections
    description: Per-network setup notes for Facebook, Instagram, X, LinkedIn, Pinterest, Google Business Profile, TikTok, YouTube and more.
    icon: "lucide:plug"
  - title: Scheduling and Calendar
    description: Learn the composer, per-platform overrides, drag-and-drop rescheduling and how the calendar handles time zones.
    icon: "lucide:calendar-days"
  - title: AI and Agents
    description: Configure providers, write a brand playbook, run the content board and understand approval gates before publishing.
    icon: "lucide:sparkles"
  - title: API, CLI and MCP
    description: Create API keys, call the REST API, script bulk operations and connect Claude or another assistant through MCP.
    icon: "lucide:terminal"
  - title: Self-Hosting
    description: Docker deployment, environment variables, database migrations, backups and the upgrade path between releases.
    icon: "lucide:server"
---
#title
Guides Organised by Task
#subtitle
What you can do with MagicSync
#description
No need to read the whole manual. Jump straight to the workflow you are setting up.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Quick start

1. **Create your account** at [register](/register) or deploy the self-hosted edition.
2. **Create a business** and fill in the audience, services and tone of voice.
3. **Connect a network** from the integrations screen and approve the requested scopes.
4. **Schedule your first post** from the composer, then confirm it on the calendar.
5. **Invite your team** if someone else should review or answer messages.

## Self-hosted in short

```bash
git clone https://github.com/leamsigc/MagicSync.git
cd MagicSync
docker compose up -d
```

Set the environment variables for your public URL, auth secret and social provider credentials, then run the database migrations. The full variable reference and upgrade notes live in the documentation site.

## Where to go next

- [API reference](/api-reference) for endpoint groups, authentication and scopes.
- [Guides](/guides) for step-by-step marketing workflows.
- [Changelog](/changelog) for what changed between releases.
- [Blog](/blog) for longer engineering and strategy write-ups.

</section>

::BaseFaq
---
list:
  - label: Do I need to read the docs to use the cloud version?
    content: No. The guided onboarding covers the three essential steps. Documentation is there when you want to configure something advanced.
    value: '1'
  - label: Where do I find the full environment variable list?
    content: The self-hosting section of the documentation lists every variable, which are required, and safe defaults for local development.
    value: '2'
  - label: Are the docs available in other languages?
    content: Product marketing pages are localised. Technical documentation is maintained in English first, with translated guides added as they are written.
    value: '3'
  - label: How do I report outdated documentation?
    content: Open an issue on GitHub or send it through the support page with the page title and what changed.
    value: '4'
---

#title
Documentation FAQ
#subtitle
Where to look when the quick start is not enough.
::

::BaseCallToAction
---
title: Ready to Build Your Workflow?
description: Start with the quick start guide, then automate whatever still feels repetitive.
primaryAction:
  label: Open the Documentation
  href: https://leamsigc.github.io/MagicSync/
secondaryAction:
  label: Read the API Reference
  href: /api-reference
---
::
