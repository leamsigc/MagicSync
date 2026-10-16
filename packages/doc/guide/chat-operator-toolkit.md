# Chat operator toolkit

## What changed

The chat is meant to be the operator for the whole product, but its tool set was
four tools. This adds the missing capability groups and wires them where the
runtime can actually reach them.

![Chat operator](/img/screenshots/app-chat/page.png)

### New tools

| Tool | Group | Wraps |
|------|-------|-------|
| `list_media`, `delete_media` | media | `assetService.findByBusinessId` / `delete` (business-scoped) |
| `get_business_profile`, `update_business_profile` | board | `businessProfileService.findById` / `update` |
| `get_performance_stats` | board | `analyticsService.getBestPosts` |
| `list_calendar_posts` | board | `postService.findByBusinessIdsForRange` |
| `list_templates`, `list_content_templates`, `apply_content_template` | content | `templateService.findByOwner`, `analyticsService.listTemplates` / `applyTemplate` |
| `bulk_schedule_posts` | delivery | `directScheduleService.scheduleDirect` per item |

## The mount budget is the real constraint

`MAX_TOOLS_PER_TURN` bounds what one model turn may offer, and
`tests/small-model.test.mjs` proves every mount fits it. Two hard pins decide
where a new tool may live:

- `research-agent`'s tool list is asserted exactly (`subagent-tool.test.mjs`).
- The slice run mounts **skill** tools, so growing `business-agent` /
  `strategy-agent` (which goal skills delegate to) blows the slice byte budget.

So the new tools are exposed through the two remaining surfaces:

1. **The chat mount** — `bulk_schedule_posts` joins the orchestrator even though
   the budget had to rise 7 → 8 for it. A bulk schedule is a chat-first action.
2. **Skill tool lists** — chat skills name their tools (`content-writer`,
   `content-ops`, `trend-scout`, `content-score`), which is how most catalog
   tools are already reached. These lists are not length-pinned by tests.

`content-writer` also referenced a non-existent `apply_template`; it now names
the real `apply_content_template`.

## Gotchas

- Adding a tool to `createAgentTools` alone makes it **declared but unmounted** —
  reachable by nothing. Always mount it (chat mount or a skill list).
- Tool descriptions must stay ≤ 140 chars (`MAX_DESCRIPTION_CHARS`).
- Every new tool keeps identity server-owned: read `ctx.userId` / `ctx.businessId`,
  never `toolCtx.data`. `delete_media` re-checks `asset.businessId === ctx.businessId`.
- Mutable/creative actions keep the established approval shape: the tool returns
  a preview or artifact; the UI performs the write. `bulk_schedule_posts` mirrors
  `schedule_direct_posts` and only runs after the user asks.

## Verify

1. `pnpm --filter @local-monorepo/agent test` passes (bag > 30, all mounts ≤ budget).
2. `pnpm audit:layers` passes.
3. Asking chat to bulk-schedule reaches `bulk_schedule_posts`; asking to delete an
   asset from another business is refused.
