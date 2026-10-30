---
layout: default
title: "AI Agents That Post with MagicSync"
description: "Connect ChatGPT, Claude, Cursor, Codex or any MCP client to MagicSync. Research, draft, schedule and publish across 18 networks with approvals and scoped keys."
head:
  htmlAttrs:
    lang: en
  bodyAttrs:
    class: ""
  meta:
    - name: keywords
      content: "AI social media agent, MCP server, ChatGPT social media, Claude social media, Cursor, Codex, AI scheduling, MagicSync"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Connect ChatGPT, Claude, Cursor, Codex or any MCP client to MagicSync. Research, draft, schedule and publish across 18 networks with approvals and scoped keys."
ogImage:
  component: BlogOgImage
  props:
    title: "AI Agents That Post with MagicSync"
    description: "Connect your AI assistant to the MagicSync scheduler"
    headline: "Your AI Agent, Your Social Calendar"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: MCP + REST API
  content: 15 AI agents supported
actions:
  - label: Start Free Trial
    href: /register
    icon: "lucide:arrow-right"
  - label: Read the Docs
    href: /documentation
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "AI agent connected to the MagicSync social media scheduler"
---
#title
Let Your AI Agent <span class="gradient-text">Run Social Media</span>

#description
Connect the assistant you already use to MagicSync. Your agent can research, draft, schedule and publish across 18 networks — with approval gates, scoped keys and an audit trail.
::

::BaseBenefits
---
items:
  - title: Works With Your Assistant
    description: ChatGPT, Claude, Claude Code, Cursor, Codex, OpenClaw, Hermes, Grok, Muse, Perplexity, nanoclaw, Paperclip and any MCP client.
    icon: "lucide:plug"
  - title: One Tool Surface
    description: 18 tools and 4 resources over MCP for drafting, scheduling, media and analytics. The REST API covers everything else.
    icon: "lucide:wrench"
  - title: Approval Gates
    description: Agents draft and queue; a human approves before anything publishes. Permissions stay on the key, not in the prompt.
    icon: "lucide:shield-check"
  - title: Scoped API Keys
    description: Read-only or full-access keys per workspace. Revoke one instantly without touching the rest of your automation.
    icon: "lucide:key-round"
  - title: Audit Every Call
    description: Each request is attributed to a key and recorded, so you can see which agent created or changed a post.
    icon: "lucide:scroll-text"
  - title: No Rebuild Required
    description: Agents use the same calendar, media library, templates, inbox and analytics as the web app.
    icon: "lucide:layout-grid"
---
#title
Why Connect an Agent
#subtitle
Your assistant, wired into a real publishing system
#description
Chat is useful for ideas. Connected to MagicSync, it becomes a social media operator with limits you control.
::

::BaseFeatures
---
list:
  - title: Draft and Schedule Posts
    description: Turn a conversation into a queued post with per-platform overrides, media and a publish time.
    icon: "lucide:calendar-plus"
  - title: Research Trends and Competitors
    description: Pull best-performing posts, scan trends and ground drafts in sources before anything is written.
    icon: "lucide:radar"
  - title: Repurpose Across Networks
    description: Turn one article, podcast or video into platform-native captions, hooks and threads.
    icon: "lucide:repeat-2"
  - title: Read Analytics
    description: Ask which posts earned replies, which network brings clicks and when your audience is active.
    icon: "lucide:chart-no-axes-combined"
  - title: Manage Media
    description: List, upload and attach assets from the shared library without leaving the conversation.
    icon: "lucide:image"
  - title: Run the Content Board
    description: Create cards, move them through research, drafting and review, and stop at the approval gate.
    icon: "lucide:kanban"
---
#title
What Agents Can Do
#subtitle
Research, write, schedule, measure
#description
Every capability is a scoped tool, so the agent can only do what the key and the business workspace allow.
::

::BaseAgentDirectory
---
columns: 3
---
#title
Browse All 15 AI Agents
#description
Pick the assistant or coding environment you already use. Each guide covers connection, scopes and a first publish.
::

::BaseHowItWorks
---
type: 'vertical'
list:
  - badgeTitle: Step 1
    title: Connect Your Agent
    description: Point an MCP client at /mcp or create a scoped API key. OAuth and key auth are both supported.
    image: "/img/home-light.png"
  - badgeTitle: Step 2
    title: Add Brand Context
    description: The agent reads your business profile, playbook, templates and past winners before drafting.
    image: "/img/home-dark.png"
  - badgeTitle: Step 3
    title: Ask for Work
    description: Request research, a week of posts, a thread, a carousel or an analytics summary in natural language.
    image: "/img/home-light.png"
  - badgeTitle: Step 4
    title: Approve and Publish
    description: Review the queue in MagicSync, approve what is ready and let the scheduler publish on time.
    image: "/img/home-dark.png"
---
#title
How It Works
#subtitle
From connection to published post
::

::BaseFaq
---
list:
  - label: What is MCP?
    content: Model Context Protocol is an open standard that lets an AI client discover and call tools. MagicSync exposes posting, media, analytics and board tools over /mcp.
    value: '1'
  - label: Which agents are supported?
    content: ChatGPT, Claude, Claude Code, Codex, Cursor, OpenClaw, Hermes Agent, Grok Bot, Grok Build, Muse, Perplexity Computer, nanoclaw, Paperclip, the MCP server itself and the AI Agents CLI.
    value: '2'
  - label: Can an agent publish without approval?
    content: Only a full-access key can publish directly. Read-only keys cannot create or schedule, and approval-gated workflows always wait for a human decision.
    value: '3'
  - label: Do I need the API if I only use ChatGPT?
    content: No. Connect through MCP with OAuth or a key. The REST API is there when you want scripts, CI jobs or your own integration.
    value: '4'
  - label: Is my data safe?
    content: Tokens and keys are scoped per workspace, requests are rate limited, every call is audited, and you can revoke a key instantly.
    value: '5'
  - label: Does it cost extra?
    content: No. MCP, the API and the CLI are included in every plan. You only pay your normal MagicSync subscription or self-host for free.
    value: '6'
---
#title
Agent FAQ
#subtitle
Connection, permissions and what the agent can actually do
::

::BaseCallToAction
---
title: Connect Your Agent Today
description: Start with one assistant, one business and one approval gate. Add automation when you trust the results.
primaryAction:
  label: Start Free Trial
  href: /register
secondaryAction:
  label: Read the MCP Docs
  href: /documentation
---
::
