# MagicSync MCP Server

Control all of MagicSync from any AI assistant: schedule posts, check analytics, generate captions, and manage media — in plain language. MagicSync exposes a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server at `/mcp` with **18 tools and 4 resources**, wrapping the same services as the dashboard.

```
You:  "Schedule a launch post for Tuesday 2pm on Instagram and X"
Claude: calls create-post → "Done — scheduled for Tue 2pm on both accounts."
```

## Prerequisites

- A MagicSync account with at least one connected social account
- An **API key** (see below)
- For web clients (ChatGPT, Claude web): a **public HTTPS** MagicSync URL — `https://magicsync.dev`, or your self-hosted domain. `localhost` only works with local harnesses (Claude Code, Cursor, VS Code).

## Step 1: Create an API Key

1. Open your MagicSync dashboard → pick the business → **Settings → API Keys**
2. Create a key named e.g. `claude-code` and copy it **once** (it is shown only at creation)
3. Paste the **entire key including its `org_` prefix** (e.g. `org_OhyzHQfD…`) wherever a client asks for a token — the prefix is part of the key, not decoration. A truncated key authenticates as anonymous and you will see zero tools.
4. The key is **bound to that one business** — it can never see or touch another business

::: warning Full access in Wave 1
Every API key currently grants full access: create, schedule, publish, and delete. Anyone holding your key can publish to all platforms the key allows. Treat keys like passwords, rotate on suspicion, and delete keys you no longer use. Scoped read-only keys (`mcp:read`) arrive in Wave 2.
:::

If a client connects but sees **zero tools**, the key is missing, expired, or revoked — the server hides everything from anonymous callers instead of erroring.

## Step 2: Connect Your Client

### Claude Code (CLI)

```bash
claude mcp add --transport http magicsync https://magicsync.dev/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

Verify with `claude mcp list` (or `/mcp` inside a session). For a team-shared setup, commit a project `.mcp.json` with `${VAR}` expansion so the secret never lands in git:

```json
{
  "mcpServers": {
    "magicsync": {
      "type": "http",
      "url": "https://magicsync.dev/mcp",
      "headers": { "Authorization": "Bearer ${MAGICSYNC_API_KEY}" }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` (or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "magicsync": {
      "url": "https://magicsync.dev/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

### VS Code (Copilot)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "magicsync": {
      "type": "http",
      "url": "https://magicsync.dev/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

### Windsurf, Cline, Roo Code

Same `mcpServers` shape with `url` + `headers` — check your client's docs for the exact config file path, which varies by version.

### Claude Desktop

Claude Desktop speaks stdio, so bridge via `mcp-remote` in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "magicsync": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://magicsync.dev/mcp",
        "--header", "Authorization: Bearer YOUR_API_KEY"
      ]
    }
  }
}
```

Restart Claude Desktop after editing.

### ChatGPT (Plus / Pro / Business / Enterprise / Edu)

ChatGPT connects to **remote HTTPS** servers as custom connectors behind Developer Mode:

1. Web app → profile → **Settings → Apps** (or Connectors) → **Advanced settings** → turn on **Developer mode**. (On managed workspaces an admin may need to allow it. Free tier has no custom connectors.)
2. **Settings → Connectors → Create**, fill in:
   - **Name:** `MagicSync`
   - **Description:** `Schedule and manage social media posts`
   - **MCP server URL:** `https://magicsync.dev/mcp` (or your self-hosted domain + `/mcp`)
   - **Authentication:** `Token` → paste your MagicSync API key
3. In a conversation, enable the connector (Developer Mode + `+` menu), then ask it to use MagicSync. ChatGPT confirms before any write action.

Self-hosters: ChatGPT cannot reach `localhost` — expose your instance over HTTPS first (see [Self-Hosting](/guide/self-hosting)).

### Claude Web (claude.ai)

1. **Customize → Connectors → Add custom connector**, paste your `https://…/mcp` URL → **Add**. (Team/Enterprise: an owner adds it org-wide first under Organization settings → Connectors, members then click Connect. Per conversation: `+` → Connectors.)
2. Claude discovers OAuth from our server automatically and walks you through sign-in: log in with MagicSync, **pick the business** to authorize, choose read-only or read+publish, Allow.
3. Revoke anytime: dashboard → API Keys → Connected Apps → Revoke (access dies immediately).

Self-hosters: Claude must reach your instance over public HTTPS.

::: warning Bearer keys don't work here
Claude web connectors only support OAuth — they cannot send API-key headers. An `org_…` key pasted anywhere in this flow connects anonymously with zero tools. Use the OAuth flow above on the web; save API keys for Claude Code, Desktop, Cursor, and VS Code.
:::

## Tool Reference

Business scoping is automatic: every tool acts on the business your key belongs to. You never pass a `businessId`. Platforms use the 17 canonical IDs: `facebook`, `instagram`, `instagram-standalone`, `twitter`, `tiktok`, `google`, `googlemybusiness`, `discord`, `linkedin`, `linkedin-page`, `threads`, `youtube`, `bluesky`, `devto`, `dribbble`, `reddit`, `wordpress`.

### Posts

| Tool | What it does | Key inputs |
|------|--------------|------------|
| `create-post` | Create a post. Omit `scheduledAt` to publish ASAP, or set a future ISO datetime to schedule | `content` (1–2000 chars), `platforms[]`, `mediaAssetIds[]`, `scheduledAt`, `postFormat` (`post`/`reel`/`story`/`short`), `platformContent` (per-platform overrides) |
| `list-posts` | List posts, newest first, with filters + pagination | `status`, `postFormat`, `startDate`, `endDate`, `platform`, `page`, `limit` (max 50) |
| `get-post` | Full details: content, status, schedule, per-platform state, assets | `postId` |
| `update-post` | Edit a pending post: content, media, platforms, or reschedule | `postId` + any of `content`, `platforms`, `mediaAssetIds`, `scheduledAt`, `postFormat`, `platformContent` |
| `delete-post` | Permanently delete a post. Already-published network posts stay live | `postId` |
| `publish-now` | Publish a pending post **right now** across its platforms; retries failed ones | `postId` |
| `retry-post` | Reset a failed post to pending so the scheduler retries it | `postId` |
| `preview-post` | Dry-run: render exactly what would publish per platform **without writing anything** | Same inputs as `create-post` |
| `post-platform-status` | Per-account publish state, platform post IDs, error messages | `postId` |

Status model: posts are `pending` (scheduled or due), `published`, or `failed`. There is no draft state — a pending post with a future `scheduledAt` is a scheduled post.

### Platforms

| Tool | What it does |
|------|--------------|
| `list-platforms` | Connected accounts for the business (IDs, names, active flags — never tokens) |
| `get-platform-health` | OAuth token health per account: `healthy` / `expiring_soon` / `expired` / `unknown` with days remaining |

Expired account? The agent cannot do OAuth — reconnect in the dashboard yourself.

### Analytics

| Tool | Key inputs | Notes |
|------|------------|-------|
| `get-post-stats` | `startDate`, `endDate`, `timezone` | Totals by status, per-account breakdown, published-today / next-7-days / failed-24h, success rate |
| `get-account-stats` | `platform`, `accountId`, `history`, `startDate`, `limit` | Latest follower snapshots, or history over time with `history: true` |

### AI Generation

| Tool | Key inputs |
|------|------------|
| `generate-caption` | `topic`, `platform`, `tone` (professional/casual/humorous/inspirational/educational/promotional), `includeHashtags`, `includeCta`, `additionalContext`, `maxLength` |
| `generate-ideas` | `topic`, `platform`, `count` (1–10 hooks) |
| `suggest-hashtags` | `topic`, `platform`, `count` (1–30), `style` (mixed/trending/niche/branded) |

These call the AI backend with your saved LLM config. They need the AI service running — with it down, tools return a clean error instead of failing silently.

### Media

| Tool | Key inputs | Notes |
|------|------------|-------|
| `list-media` | `mimeType` (image/video), `page`, `limit` (max 50) | Returns asset **IDs** — feed them to `create-post` as `mediaAssetIds`, never raw URLs |
| `search-media` | `query`, `mimeType`, `limit` | Matches filenames (no full-text index — scans newest 100) |

## Resources

| URI | What it returns |
|-----|-----------------|
| `magic-sync://calendar/{month}` | All posts in a `YYYY-MM` month, all statuses |
| `magic-sync://platforms/status` | Connected platforms + token health snapshot |
| `magic-sync://posts/{postId}` | Full post details (same as `get-post`) |
| `magic-sync://analytics/summary` | Posting activity + latest per-account stats |

## Example Workflows

**Plan my week.** *"Check my calendar for next week, find the empty days, and draft posts for them about our launch — then show me the previews before scheduling anything."* (calendar → generate-caption → preview-post → create-post)

**Morning briefing.** *"How did my posts do last month, and which platform grew most?"* (get-post-stats → get-account-stats with `history: true`)

**Fix failures.** *"Any failed posts in the last 24h? Show me the errors and retry the ones that look transient."* (get-post-stats → post-platform-status → retry-post)

**Repurpose.** *"Take my best-performing tweet this month and adapt it for LinkedIn and Instagram, scheduled for tomorrow morning."* (get-post-stats → get-post → generate-caption → create-post)

## Security Model

- **Per-business keys** — a key admits exactly one business; cross-business access is impossible by construction
- **Hidden, not forbidden** — wrong or missing key returns an empty tool list, never data
- **Every write audited** — create/update/publish/delete/preview calls land in the admin audit log with key, business, and outcome
- **Platform allowlists** — keys can be restricted to specific platforms, so a leaked key can't publish everywhere
- **Preview before publish** — `preview-post` renders per-platform output (limits, overrides, media) with zero writes; `publish-now` goes live on real networks with no undo

## Troubleshooting

| Symptom | Cause → Fix |
|---------|-------------|
| Client connects, **zero tools** | Bad/missing/expired key → re-check the `Authorization: Bearer …` header and regenerate the key if needed |
| `Platform(s) not connected` | Agent named a platform with no connected account → connect it in the dashboard, or run `list-platforms` first |
| `Validation failed for X: Content exceeds N` | Platform character limit → shorten, or set per-platform `platformContent` |
| AI tools return errors | AI backend not running/reachable → start it; reads and scheduling still work |
| `publish-now` succeeds but a platform stays pending/failed | Per-network rejection (bad token, rate limit) → check `post-platform-status` error messages, then `get-platform-health` |
| ChatGPT can't reach the server | `localhost` or plain HTTP → expose public HTTPS (tunnel or hosted domain) |
| Claude web shows no tools | Expected — see [Claude Web limitation](#claude-web-claude-ai-limited) |

## For Developers

The server lives in `packages/site/server/mcp/` (`@nuxtjs/mcp-toolkit`, route `/mcp`). Tools are thin wrappers around existing service singletons — see `.aiContext/PRD-MCP-TOOLKIT.md` for the implementation tracker, and `.claude/patterns/add-mcp-tool.md` for the contributor pattern. The MCP Inspector is available in dev mode for interactive testing.
