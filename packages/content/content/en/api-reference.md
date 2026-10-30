---
layout: default
title: "API Reference: REST and MCP Endpoints | MagicSync"
description: "Build on MagicSync with API keys, scoped REST endpoints for posts, businesses, media and analytics, plus an MCP server for AI assistants."
head:
  htmlAttrs:
    lang: en
  meta:
    - name: keywords
      content: "social media API, social media scheduling API, MCP server, API keys, automate social media posts, MagicSync API"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Build on MagicSync with API keys, scoped REST endpoints for posts, businesses, media and analytics, plus an MCP server for AI assistants."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync API Reference"
    description: "REST endpoints, scopes and the MCP server"
    headline: "Build on the MagicSync API"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Developer API
  content: REST, CLI and MCP
actions:
  - label: Create an API Key
    href: /app/keys
    icon: "lucide:arrow-right"
  - label: Read the Docs
    href: /documentation
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync API keys and endpoint documentation"
---
#title
Build on the <span class="gradient-text">MagicSync API</span>

#description
Everything the interface can do is available to scripts and AI assistants: create posts, queue them, inspect results and read analytics with scoped keys and audit logging.
::

::BaseFeatures
---
list:
  - title: Scoped API Keys
    description: Create read-only or full-access keys per workspace. Revoke a key instantly without touching the rest of your automation.
    icon: "lucide:key-round"
  - title: REST Resource Groups
    description: Predictable JSON endpoints for posts, businesses, accounts, media, analytics, templates and the agent runtime.
    icon: "lucide:braces"
  - title: MCP Server
    description: Connect Claude or any MCP client to discover tools and resources, then draft and schedule posts through natural language.
    icon: "lucide:bot"
  - title: Audit Every Call
    description: Each request is attributed to a key and recorded, so you can see which automation created or changed a post.
    icon: "lucide:scroll-text"
---
#title
Designed for Automation
#subtitle
What you can do with MagicSync
#description
Stable shapes, explicit scopes and logs that answer "who changed this?".
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Authentication

Create a key at [API keys](/app/keys) and send it as a bearer token:

```bash
curl https://magicsync.dev/api/v1/posts \
  -H "Authorization: Bearer $MAGICSYNC_API_KEY"
```

Keys belong to a user and are limited to that user's businesses. Read-only keys can list and fetch; full-access keys can create, update, schedule and publish.

## Endpoint groups

| Group | Base path | Typical use |
|---|---|---|
| Posts | `/api/v1/posts` | Create, update, schedule and inspect posts |
| Businesses | `/api/v1/business` | Workspaces, profiles and brand context |
| Accounts | `/api/v1/accounts` | Connected social accounts and status |
| Media | `/api/v1/media` | Upload and reference images and video |
| Analytics | `/api/v1/stats` | Reach, engagement and post performance |
| Templates | `/api/v1/templates` | Reusable post and variable templates |
| Bulk scheduler | `/api/v1/bulk-scheduler` | CSV imports and batch creation |
| Agent | `/api/v1/agent` | Chat sessions, capabilities and runs |
| API keys | `/api/v1/api-keys` | Create, list and revoke keys |
| MCP | `/mcp` | Tool and resource discovery for AI clients |

Exact request bodies, query parameters and response schemas are documented per endpoint in the OpenAPI description exposed by the running instance.

## MCP in one minute

Point an MCP client at `https://magicsync.dev/mcp`, authenticate with a key or OAuth, and the assistant can list tools and resources. Approval-gated actions stay gated: the assistant can draft and queue, but publishing follows the permissions on the key.

## CLI

The companion CLI wraps the same API for terminal workflows such as bulk text imports and scheduled checks. See the [CLI guide](/blogs/magicsync-cli-social-media-automation) for a walkthrough.

</section>

::BaseFaq
---
list:
  - label: Is there a rate limit?
    content: Yes. Requests are limited per key and per IP, with higher limits for authenticated workspace keys. Responses include retry guidance when a limit is hit.
    value: '1'
  - label: Can a key publish without approval?
    content: Only a full-access key can publish directly. Read-only keys cannot create or modify posts, and approval-gated workflows still require a human decision.
    value: '2'
  - label: Do you provide an OpenAPI schema?
    content: Yes. The running instance exposes an OpenAPI description of the API, which you can import into Postman, Insomnia or a client generator.
    value: '3'
  - label: Is the API available on self-hosted installs?
    content: Yes. The same routes ship with the Docker edition. Point your base URL at your own domain.
    value: '4'
  - label: How do I rotate a leaked key?
    content: Revoke it immediately from the API keys screen, then create a replacement. Revocation takes effect on the next request.
    value: '5'
---

#title
API FAQ
#subtitle
Authentication, limits and safety for programmatic access.
::

::BaseCallToAction
---
title: Create Your First API Key
description: Generate a scoped key and make your first request in a couple of minutes.
primaryAction:
  label: Open API Keys
  href: /app/keys
secondaryAction:
  label: Read the Docs
  href: /documentation
---
::
