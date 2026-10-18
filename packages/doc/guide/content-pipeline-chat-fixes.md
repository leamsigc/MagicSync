# Content Pipeline & Chat Fixes (media caps, carousel revision, ideas, empty drafts)

_2026-10-17 — five production complaints across publishing and the agent chat,
their root causes, and what changed._

## Why

A round of user reports pointed at the content pipeline:

| Report | Symptom |
|---|---|
| Carousel posts | A multi-image post failed on Twitter/X, Bluesky, Facebook, Google Business |
| Chat carousel edit | "`revise_carousel` is not available in my current set of tools" |
| Chat "write post" | Output did not look like `/app/posts/new` (connected platforms should be on the left) |
| Content board "Find ideas" | Always "the agent found no ideas for this topic" |
| Card "Write now" | Returned success but produced no article at all |

They are five separate defects.

## What changed

### 1. Multi-image posts are clipped, never rejected

`maxImages` was defined once in `packages/shared/shared/platformConstants.ts`
but **only the client and the CLI/MCP validators ever read it** — plugins were
handed the whole `postDetails.assets` array. Bluesky (>4), Facebook (>10) and
Google Business (>1) sent them all and the Graph API rejected the publish;
X/Instagram/Threads hard-coded their own slice; LinkedIn/Pinterest/Snapchat
silently dropped the extras.

`AutoPostService.clipAssetsForPlatform()` now trims a post's **images** to the
target platform's `maxImages` before publishing (`videos` are never clipped;
`maxImages: 0` means "leave alone"). When images are dropped the user gets a
`warning` notification naming the platform, so the cap is announced rather than
silent. The clip happens on a copy, so other platforms in the same batch still
get the full set.

### 2. Carousel edits work from plain chat

The revision harness only activated when the client sent `carouselRevision`,
which the UI sets **only via the page picker**. Typing "change the slide count"
fell through to the normal chat mount — which deliberately has no
`revise_carousel` (the mount sits at the 8-tool budget) — so the model refused.

`chat.post.ts` now detects an edit verb + carousel noun
(`isCarouselRevisionIntent`), resolves the business's most recent carousel
artifact (`contentArtifactService.listArtifacts` → first `outputKind: 'carousel'`)
and routes the turn to `revise_carousel` in single-tool mode with that artifact.
A structural request (`isSlideCountIntent`) gets a harness prompt that allows the
whole deck to change, so "change the slide count" is not blocked by the
"never rewrite the whole deck" rule.

### 3. "Find ideas" always returns cards

`generateContentIdeas` had a brief-derived fallback, but it only ran when the
model **responded with zero valid ideas**. When the brief yielded nothing too,
the batch was empty and the UI said "no ideas".

`deriveGroundedIdeas()` (new) keeps the brief-derived angles when there are any
(so existing behaviour and counts are respected) and, **when the brief yields
nothing**, tops up to at least `MIN_IDEAS = 5` with evergreen angles grounded in
the business name/industry/location (`angleTemplates`). Research failure now
degrades to a topic-only brief instead of failing the scan.

> **Deliberate non-change:** a *downed provider* still fails loud
> (`CONTENT_INCOMPLETE`) — `generateIdeasOrFallback` does not catch completion
> errors. `tests/slice-b.test.mjs` pins that: a provider outage must be
> diagnosable, not masked by generic template ideas.

### 4. "Write now" can no longer "succeed" empty

`writePost`/`writeArticle` returned `success: true` for any reply, including
`''`/`{}`; the artifact contract defaults `caption`/`article` to `''`; and the UI
toasted success unconditionally. So a blank completion produced a valid, empty
artifact and a green toast.

The guard now sits at the **composed-draft boundary**
(`capabilities/content.ts` `draftHasContent`): if the final draft has no caption,
no article **and** no variants, `content.write` fails with `EMPTY_OUTPUT` and
`useContentEditor.write()` shows a failure toast instead of success.

> Placing the guard in `writePost` was wrong: an empty caption is legitimate when
> the article or platform variants carry the content
> (`content-api.test.mjs` "falls back to the platform body when the card has no
> short caption"). Guard the *whole* draft, not one field.

### 5. Chat "write post" embeds the real composer on the left

Covered separately in [Chat post composer](/guide/chat-carousel-revision-routing)
and the composer docs — `PostModalContent` gained a `platformsPosition: 'left'`
mode (a vertical `PostPlatformSelector` column), `ChatPostComposer` gained an
`inline` variant, and the chat page renders it inline in the thread instead of a
modal.

## How to verify

```bash
pnpm --filter @local-monorepo/agent test          # content chain + capabilities
cd packages/site && pnpm exec tsc --noEmit -p tsconfig.json
pnpm site:build                                    # compiles the Vue templates
```

Manual:

1. Compose a 6-image post, target Twitter + Facebook → it publishes to both; a
   "some images were skipped" warning names Twitter.
2. Generate a carousel, then type "change the slide count to 6" in chat → the
   deck is revised (no "tool not available").
3. On an idea card, click **Find ideas** for a thin topic → at least 5 cards.
4. Click **Write now** with the AI provider misconfigured → a failure toast, not
   a silent empty card.
5. Click **Edit & schedule** on a chat draft → the composer appears with the
   connected platforms on the left.

## Related

- [Provider Token Error Triage](/guide/provider-token-error-triage)
- [Carousel revision routing](/guide/chat-carousel-revision-routing)
- `packages/scheduler/server/services/AutoPost.service.ts`,
  `packages/agent/server/content-intelligence/generate.ts`,
  `packages/agent/server/capabilities/content.ts`

## Chat / content tool & skill audit (2026-10-18)

Driving `/app/chat` and the content board surfaced two wiring gaps and one
model-default bug:

- **`schedule_direct_posts` was unmounted from the catalog.** It is in
  `CHAT_AGENT_MOUNT` and defined in `delivery.tools.ts`, but was missing from
  `AGENT_TOOL_CATALOG`. Because `AGENT_TOOL_NAMES` derives from the catalog, the
  oversight/options UI never listed it **and** the chat route filtered it out of
  any client-supplied `allowedTools`. Added to the catalog (delivery group).
- **The `content-ops` skill referenced the retired `subagent` tool.** Delegation
  is Flue's built-in `task`; `subagent` no longer exists. The skill's spec and
  frontmatter also disagreed. Both now list
  `board_list, board_move, board_add_cards, list_media, delete_media`.
- **The system default model was out of sync with the catalog.**
  `SYSTEM_DEFAULT_MODEL` was `gemini-2.5-flash`, but `models.json` lists only
  Gemini 3.x (`gemini-3.8/3.6/3.5-flash`, `3.1-flash-lite`, `3.1-pro-preview`).
  Git history shows the catalog was bumped to 3.x while the constant stayed at
  2.5 — exactly the drift the comment above it warns about. New users (no LLM
  config) therefore resolved a model the catalog does not list, which is what
  produced the "No response received" / "found no ideas" / empty-draft reports.
  The default is now `gemini-3.5-flash`.

> Remaining environment finding: with the Google default, the model calls a tool
> and the tool runs, but the **tool-result follow-up call** returns
> `400 status code (no body)` from Google's OpenAI-compatible endpoint. The same
> turn on `openai/gpt-4o-mini` completes with a real answer. The Google compat
> tool round-trip is the outstanding item for a clean chat reply.

Evidence: `packages/doc/public/img/screenshots/app-chat/` (open, tools, message,
reply, and a retained `04-chat-run.png` showing a completed `board_list`) and
`app-business-id-content/01..09` (the manual board lifecycle).
