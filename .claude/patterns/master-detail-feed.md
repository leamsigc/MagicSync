---
name: master-detail-feed
description: Building an inbox-style master-detail view — filterable list on the left, shared detail pane on the right, with the same pane reused by the detail route
triggers:
  - "master detail"
  - "inbox style"
  - "split view"
  - "list and detail"
  - "feed view"
edges:
  - target: "theme-tokens.md"
    condition: "when styling the detail pane for light/dark"
  - target: "../.aiContext/DESIGN.md"
    condition: "always — spacing, radius and colour tokens"
last_updated: 2026-10-16
---

# Master-detail feed

## Context

A list page where users want to scan items *and* read one item's full detail
without a navigation round-trip. Worked example: the `/app/posts` **Feed** view
(`packages/scheduler/app/components/scheduler/posts/components/views/PostsFeedView.vue`)
and its shared pane (`…/components/PostDetailPane.vue`).

## Steps

1. **Extract the detail into a prop-driven component first.** Signature:
   `post: Item | null`, `loading?`, `error?`, `showBack?`, `openTo?`; emits
   `back` / `retry`. It never fetches.
2. **Reuse it on the detail route.** The route renders the same pane with
   `show-back`, so direct links and the inline pane cannot drift.
3. **Layout** — `grid w-full gap-4 lg:h-[calc(100dvh-8rem)] lg:grid-cols-[26rem_minmax(0,1fr)]`.
   Left: `flex min-h-0 flex-col` with a `min-h-0 flex-1 overflow-y-auto` list.
   Right: `hidden lg:block lg:h-full lg:overflow-y-auto`.
4. **Filter tabs** filter the loaded list client-side, show per-tab counts, and a
   `watch` re-selects the first visible row when the selection is filtered out.
5. **Selection** sets the row and, on `useMediaQuery('(max-width: 1023px)')`,
   navigates to the detail route instead.
6. **Empty states** for both panes — "nothing yet" vs "nothing matches".

## Gotchas

- `useAsyncData` with a getter key + `watch` left `data` null (perpetual spinner)
  while a direct `$fetch` returned 200. Use an explicit `ref` + `load()`.
- `lg:h-full` panes need a definite height on the grid; `min-h-0` enables scroll.
- A 26rem list column fits four labelled tabs with counts; narrower clips them.
- Token colours only in the pane (`text-highlighted`, `border-default`, …).

## Verify

- Playwright seeds rows, opens the view and captures `feed` + `feed-detail`, plus
  the detail route. Re-run replaces the images.

## Update Scaffold

- [ ] Wiki: `/guide/posts-feed-master-detail`
- [ ] Skill: `packages/doc/skills/master-detail-feed/SKILL.md`
