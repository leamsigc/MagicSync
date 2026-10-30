---
layout: default
title: "Claude + MagicSync — Turn Claude into your social media operator"
description: "Connect the MagicSync MCP server as a Claude connector and run your calendar from a conversation, with approvals before anything publishes."
seo:
  twitterCard: summary_large_image
  twitterTitle: "Claude + MagicSync — Turn Claude into your social media operator"
  twitterDescription: "Turn Claude into your social media operator"
  ogTitle: "Claude + MagicSync — Turn Claude into your social media operator"
  ogDescription: "Turn Claude into your social media operator"
ogImage:
  component: BlogOgImage
  props:
    title: "Claude + MagicSync"
    description: "Turn Claude into your social media operator"
    headline: "AI Agents · Claude"
    imageUrl: "/img/home-dark.png"
head:
  htmlAttrs:
    lang: en
---

::BaseHero
---
badge:
  label: "AI Agents"
  content: "MagicSync MCP"
actions:
  - label: "Start free"
    href: /register
    icon: "lucide:arrow-right"
  - label: "MCP documentation"
    href: /guide/mcp
    variant: outline
showHeroImage: false
---
#title
Claude + MagicSync

#description
Turn Claude into your social media operator. Connect the MagicSync MCP server as a Claude connector and run your calendar from a conversation, with approvals before anything publishes.
::

::AgentConnect
---
agent: "claude"
tagline: "Turn Claude into your social media operator. Connect the MagicSync MCP server as a Claude connector and run your calendar from a conversation, with approvals before anything publishes."
---
::

::BaseFeatures
---
list:
  - title: "Agent-native publishing"
    description: "Ask in plain language. MagicSync turns the request into drafts, scheduled posts and platform-specific formatting."
    icon: "lucide:bot"
  - title: "One calendar for every channel"
    description: "Instagram, X, LinkedIn, Facebook, Threads, TikTok, YouTube, Bluesky, Pinterest, Reddit, WordPress and more — one queue."
    icon: "lucide:calendar-check"
  - title: "Approval gates and audit log"
    description: "Every tool call is logged. Publishing waits for your approval until you grant full access."
    icon: "lucide:shield-check"
  - title: "18+ platforms"
    description: "The same connected accounts you already use in MagicSync, with their limits and previews."
    icon: "lucide:share-2"
---
#title
What Claude can do with MagicSync
#description
Everything your agent needs to plan, publish and stay accountable.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "How do I connect Claude to MagicSync?"
    content: "Copy the MagicSync MCP endpoint, add it to Claude as a custom MCP connector, and approve access with your MagicSync account. OAuth clients need no API key."
    value: '1'
  - label: "Do I need an API key?"
    content: "Not for OAuth-capable MCP clients. Headless scripts and cron jobs use a scoped API key created in API Keys, with read-only or full access."
    value: '2'
  - label: "Does Claude see my social media passwords?"
    content: "No. MagicSync stores the platform tokens and exposes tools over MCP. The agent only receives tool results, never your credentials."
    value: '3'
  - label: "Will it publish without my approval?"
    content: "Writes are gated by default. You can require approval for every publish, or grant full access when you trust the workflow."
    value: '4'
  - label: "Is MagicSync free to start?"
    content: "Yes. Self-host it for free, or use the hosted plan for managed hosting, analytics and team members."
    value: '5'
---
#title
Frequently asked questions
#description
Short answers about the connection, access and publishing.
::

::AgentOtherAgents
---
agent: "claude"
---
::

::BaseCallToAction
---
title: "Let Claude run your social media"
description: "Connect MagicSync once and keep the same accounts, approvals, calendar and analytics you already use."
primaryAction:
  label: "Start free"
  href: /register
secondaryAction:
  label: "MCP documentation"
  href: /guide/mcp
---
::
