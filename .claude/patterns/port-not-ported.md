---
name: port-not-ported
description: Replace a NOT_PORTED 501 stub (ex-Python proxy) with a native Nuxt implementation
triggers:
  - "NOT_PORTED"
  - "501 in the Nuxt agent runtime"
  - "port python endpoint"
edges:
  - target: patterns/add-endpoint.md
    condition: when exposing the ported capability as a new endpoint
  - target: context/conventions.md
    condition: when checking ServiceResponse and error handling patterns
last_updated: 2026-09-13
---

# Port NOT_PORTED Stubs

## Context

T14 deleted the Python backend and left `notPorted()` 501 stubs behind in
`packages/ai-tools/server/` (see `server/utils/notPorted.ts`). The UI still
calls some of them (e.g. `ArtifactCard` virality/engagement buttons), so
users hit `501 NOT_PORTED`. The pre-stub contract is recoverable: the old
route proxied to a Python tool, and the Python tool usually delegated to an
authoritative Nuxt service that still exists in `packages/db`.

## Steps

1. Read the stub route, then `git show HEAD:<route>` (or the commit before
   the T14 removal) for the original proxy: which Python tool it called and
   with which args.
2. In git HEAD (`git grep`), find the Python tool implementation and what it
   delegated to — most analytics/generation tools called back into Nuxt
   internal routes whose logic now lives in `packages/db` services
   (`analyticsService.scoreVirality/calculateEngagement/getPostPerformance`,
   `contentArtifactService`, ...).
3. Check `packages/db/tests/*.mjs` for pinned behavior of the service you
   plan to use. If tests pin it (e.g. the 35-point content heuristic in
   `analytics-templates.test.mjs`), do not change the service — adapt at the
   route/util layer instead.
4. Keep the route thin (auth → `loadArtifactContext`-style loader → one
   service call → shape the response). Put pure logic (output flattening,
   draft heuristics, arg resolution) in `server/utils/` next to the route.
   Never move a measured-vs-estimated distinction: drafts must be labelled
   `heuristic` with an explicit reason, never fabricated metrics.
5. Preserve the response contract the UI reads (virality/engagement return
   `{ result }`, consumed as `res.result` in `ArtifactCard`). Reuse
   `generationErrorStatus` from `server/utils/socialAi.ts` for error mapping.

## Gotchas

- Precedent: `artifacts/[id]/virality.post.ts` (measured via
  `getPostPerformance` when `artifact.postId` exists, structural
  `scoreDraftVirality` heuristic otherwise) and `engagement.post.ts`
  (`calculateEngagement` over body `postIds` or the artifact's own post;
  400 with a plain-language reason when a draft has nothing measurable).
- Artifact `output` is string OR object at runtime (string variants vs
  `{caption, hashtags}` variant objects) — flatten defensively.
- `#ai-tools/*` aliases don't resolve in plain-node tests; pure helpers can
  still be exercised ad-hoc by importing the file URL with the agent
  `register-hook.mjs` after `initTestDb()` from `tests/setup.mjs`.
- Repo ESLint is broken environment-wide (`typescript-eslint` vs TS 7.0);
   verify with esbuild transpile + `@vue/compiler-sfc` parse instead.

## Verify

- [ ] Former 501 now returns the UI's `{ result }` shape for draft and
      published artifacts
- [ ] Draft results labelled heuristic; measured results carry version
- [ ] `pnpm --filter @local-monorepo/db test:services` green
- [ ] Complexity ≤ 5 per changed function; `git diff --check` clean
