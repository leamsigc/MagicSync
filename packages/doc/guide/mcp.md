# MagicSync MCP Server

Control all of MagicSync from any AI assistant: schedule posts, check analytics, generate captions, and manage media — in plain language. MagicSync exposes a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server at `/mcp` with **33 tools and 4 resources**, wrapping the same services as the dashboard.

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

### MCP Inspector (local testing)

Against local dev (`pnpm dev`), point Inspector at `http://localhost:3000/mcp`:

1. **Easiest — Dynamic Client Registration (no setup):** leave Inspector's Client Settings untouched. Our server keeps DCR enabled, so Inspector registers itself on first connect → log in with MagicSync → pick the business → Allow.
2. **CIMD (preferred per MCP 2026-07-28, SEP-991):** our server advertises `client_id_metadata_document_supported: true` (see `/api/auth/.well-known/oauth-authorization-server`). In Inspector web → **Client Settings** → **Client ID Metadata Document**, paste `https://www.mcpjam.com/.well-known/oauth/client-metadata.json`, enable **Use Client ID Metadata Document**. That public document already lists Inspector's callback, so nothing to host. (Our consent screen will show the document's `client_name`, i.e. "MCPJam" — cosmetic only.)
3. **Own CIMD (your name on the consent screen):** host a static JSON file at any public HTTPS URL. Our server fetches it server-side, so `localhost` files won't work. Minimum content — `client_id` must equal the URL exactly, and `redirect_uris` must contain Inspector's callback **exactly** (`localhost` ≠ `127.0.0.1`):

```json
{
  "client_id": "https://your-domain.com/inspector-client.json",
  "client_name": "My Inspector",
  "redirect_uris": ["http://localhost:6274/oauth/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "openid profile email mcp:read mcp:full"
}
```

Callback URLs by surface: web → `http://localhost:6274/oauth/callback`; CLI/TUI → `http://127.0.0.1:6276/oauth/callback` (override with `--callback-url` / `MCP_OAUTH_CALLBACK_URL`).

> **Enterprise IdP mode is not supported by this server.** Inspector's "enterprise-managed authorization" needs an enterprise IdP tenant *plus* a resource AS configured to trust it (ID-JAG validation). Our AS only honors its own users/tokens — see below. For testing, use DCR or CIMD above.

### opencode

Add to your project's `opencode.json` (or `~/.config/opencode/opencode.json` for global use):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "magicsync": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

Notes:

- Against **local dev** (`pnpm dev`), use `http://localhost:3000/mcp`. Against your hosted instance, use `https://your-domain/mcp`.
- Keep the key out of git: `"headers": { "Authorization": "Bearer ${MAGICSYNC_API_KEY}" }` works with env expansion — export `MAGICSYNC_API_KEY` before launching opencode.
- Verify inside opencode with `/mcp` (lists connected servers) — `magicsync` should show **33 tools**. Then try: *"Use magicsync to list my platforms and show next week's calendar."*
- opencode speaks Streamable HTTP, same as the `/mcp` route serves — no SSE transport or extra bridge needed. If tools don't appear, re-check the header (a truncated key without its `org_` prefix authenticates as anonymous → zero tools, by design).

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

### Carousels

Carousel decks are user-scoped: one business key resolves to a single owner, so all key holders share the same decks (v1 limitation, documented). Iterate with `update-carousel` on the same row — never create duplicates per tweak.

| Tool | What it does | Key inputs |
|------|--------------|------------|
| `create-carousel` | Create a deck from structured slides (templateKey + copy) | `name`, `slides[1..15]` (`templateKey`, `headline`, `kicker`/`body`/`items`/`quote`/`author`/`stat`/`statLabel`/`cta`/`footer`/`images`), `palette`, `handle` |
| `list-carousels` | Deck summaries, newest first | (none) |
| `get-carousel` | Full deck: slides, palette, share URL when published | `carouselId` |
| `update-carousel` | Edit in place: name, full slide replacement, palette, handle | `carouselId` + fields to change |
| `delete-carousel` | Permanently delete deck + share link | `carouselId` |
| `publish-carousel` | Public share link (`/tools/carousel/shared/[slug]`) for pixel-final review | `carouselId` |
| `unpublish-carousel` | Remove the share link, keep the deck | `carouselId` |
| `export-carousel-images` | Render slides to 1080×1350 PNGs server-side, store as assets, create a placeholder post (24h out) | `carouselId`, `platforms[]` (default Instagram), `caption` |

Decks allow 1–15 slides; Instagram export enforces 2–10 at `export-carousel-images` time. The export draft never publishes on its own — always follow with `update-post` for the final caption + schedule.

### Menu Boards

TV signage (save/share only — boards never become social posts). Same ownership model as carousels.

| Tool | What it does | Key inputs |
|------|--------------|------------|
| `create-menu-board` | Create a board with HTML/image pages + display settings | `name`, `pages[]` (`name`, `type` html/image, `content`, `isActive`, `order`), `settings` (`transitionTime`, `unlockPin`) |
| `list-menu-boards` | Board summaries, newest first | (none) |
| `get-menu-board` | Full board: pages, settings, share URL when published | `boardId` |
| `update-menu-board` | Edit in place; republish to refresh the public snapshot | `boardId` + fields to change |
| `delete-menu-board` | Permanently delete board + share link | `boardId` |
| `publish-menu-board` | Public fullscreen display URL (`/tools/menu-board/shared/[slug]`, active pages only) | `boardId` |
| `unpublish-menu-board` | Remove the display URL, keep the board | `boardId` |

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

**Carousel post.** *"Make an Instagram carousel about our launch: 5 slides, bold tone."* (design in chat → create-carousel → export-carousel-images → update-post with the final caption + schedule)

**Menu board.** *"Build a lunch menu board for the downtown store and give me the TV link."* (create-menu-board → publish-menu-board)

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
| Claude web shows no tools | API key pasted instead of OAuth, or grant revoked → use the OAuth flow under [Claude Web](#claude-web-claude-ai); check Connected Apps for the grant |

## For Developers

The server lives in `packages/site/server/mcp/` (`@nuxtjs/mcp-toolkit`, route `/mcp`). Tools are thin wrappers around existing service singletons — see `.aiContext/PRD-MCP-TOOLKIT.md` for the implementation tracker, and `.claude/patterns/add-mcp-tool.md` for the contributor pattern. The MCP Inspector is available in dev mode for interactive testing.
