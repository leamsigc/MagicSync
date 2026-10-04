---
name: web-grounded-research
description: Ground a board action in live web evidence — LLM brief, SSRF-safe scrape, synthesis, persist to brief
triggers:
  - "research action"
  - "web research"
  - "scrape for research"
  - "ground with web"
edges:
  - target: patterns/add-endpoint.md
    condition: when exposing the research as an endpoint
  - target: context/conventions.md
    condition: when checking ServiceResponse and error handling patterns
last_updated: 2026-09-14
---

# Web-Grounded Research

## Context

One-shot LLM research invents sources. When an action needs real internet
evidence, do three passes: LLM brief with candidate URLs → live-scrape the
URLs (SSRF-safe, failures skipped) → synthesis pass that may only cite URLs
that resolved. Persist findings to the card `brief` (visible + editable in
the drawer) and degrade to the LLM brief when nothing resolves.

## Steps

1. First pass reuses `contentChainService.researchTopic` (brand context is
   already framed as untrusted). It returns `{ brief, citations }` and asks
   for key facts, numbers, viewpoints, and takeaways (brief under 800 words,
   at least 3 citations when possible).
2. Scrape with `scrapePublicPage` from
   `#layers/BaseShared/server/utils/fetch-page` (DNS-validating SSRF guard,
   10s timeout, never throws — unsafe/failed pages resolve `null`).
   Cap at 5 URLs via a `pickResearchUrls` helper (http-only, deduped).
3. Synthesis pass via `ctx.complete`: initial brief + numbered evidence
   blocks labeled UNTRUSTED, strict-JSON `{"brief", "citations"}` output,
   explicit "only cite URLs from the evidence list" instruction. The rewrite
   covers what/why/how, key numbers, competing viewpoints, and practical
   takeaways (under 800 words).
4. Format with `formatBriefWithSources` (appends a `Sources:` section; bare
   brief when no citations) and persist via
   `contentBoardService.update(..., { brief })`.
5. Record the step with `contentBoardService.recordRun(..., { step, status })`
   so the activity feed shows completed/failed — failures never silent.

## Gotchas

- Precedent: `researchWithWeb` in
  `packages/agent/server/services/content-chain.service.ts`, triggered by the
  `research` action in `content-items/[id]/actions.post.ts`, edited in the
  drawer via `PUT /api/v1/content-items/[id]`.
- No search engine is wired: candidate URLs come from the LLM pass. Adding
  ScrapeGraphAI `search` is the follow-up when discovery (not just
  verification) is needed.
- `research_ready` cards reuse the saved brief: `prepareBrief` in
  `agent-workflow.service.ts` skips re-research for that state, so end the
  action on `research_ready` (via `researching` — direct `idea` jumps fail
  the state machine).
- `failed → researching` is not a valid transition: the research action
  errors there today, same as before. Fix by extending transitions, not by
  special-casing the handler.
- Branch budget: keep each function ≤ 5 (`researchWithWeb` sits at exactly
  5: catch + 3 guards + loop).
- The writer chain reuses the saved brief: `prepareBrief` in
  `agent-workflow.service.ts` runs the same web-grounded research for
  `idea`/`researching` cards and skips re-research for `research_ready`,
  so the writer always drafts from complete research. `write_post` carries
  a per-platform playbook (`PLATFORM_PLAYBOOK` in `content-chain.service.ts`)
  so each variant is optimized for its platform's length, hashtag, tone,
  and CTA conventions.

## Verify

- [ ] `scrapePublicPage('http://169.254.169.254/...')` resolves `null`
- [ ] Unreachable citation hosts degrade to the LLM brief (`sourcesUsed: 0`)
- [ ] Reachable URLs synthesize with a `Sources:` section naming only
      resolved URLs
- [ ] Card lands on `research_ready` with the brief saved; drawer shows +
      edits it
- [ ] `pnpm --filter @local-monorepo/agent test` green
