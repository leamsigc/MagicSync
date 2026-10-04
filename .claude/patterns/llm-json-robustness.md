---
name: llm-json-robustness
description: Parsing small-model JSON output without CAROUSEL_INVALID-style failures — fence stripping, balanced-brace scan, trailing-comma repair, key aliases, one repair retry
triggers:
  - "CAROUSEL_INVALID"
  - "model produced no usable"
  - "parse model JSON"
  - "strict JSON"
edges:
  - target: context/conventions.md
    condition: when checking ServiceResponse error handling for parse failures
  - target: patterns/debug-api.md
    condition: when the failure surfaces as a tool error in chat
last_updated: 2026-09-23
---

# LLM JSON Robustness

## Context

Small models (the enforced small-model budgets) rarely return pristine JSON.
They wrap payloads in fences, add prose with stray braces, emit trailing
commas, use synonym keys (`title`/`text` instead of `headline`/`body`), and
truncate long decks. Every `extractJsonObject` + `normalize*` boundary must
assume hostile formatting. Single source: `extractJsonObject` lives in
`packages/agent/server/utils/run-config.ts` — never duplicate it per service.

## Steps

1. Parse with the shared `extractJsonObject` (fences stripped, balanced-brace
   candidates longest-first, trailing-comma repair attempt per candidate).
2. Normalize with key aliases via `firstString` (`headline/title/heading/name`,
   `body/text/content/description/subtitle`) — never require exact keys.
3. Generate through `completeCarouselSlides(complete, input, minimum)` — one
   bounded repair retry carrying a strict-JSON nudge. Callers keep their
   `CAROUSEL_INVALID` gate and codes unchanged.
4. Strengthen the prompt (`carousel.md`): "strict JSON only — no fences, no
   prose, no trailing commas, exactly these keys".

## Gotchas

- First-`{`/last-`}` slicing breaks on prose braces — the balanced scan exists
   for exactly this case; do not regress to index slicing.
- `normalizeSlides` drops headline-less slides and returns `[]` below minimum
   — an alias miss looks identical to "model produced nothing". Check keys first.
- Truncated output (`maxTokens` hit) is unrecoverable by parsing; the repair
   retry is the only save. Keep deck `maxTokens` at 3000 for ≤10 slides.
- `content-chain.service.ts` used to keep a local `extractJsonObject` that
   sliced `first{`→`last}` and fell back to the **raw reply** — a truncated
   writer reply then got stored with the whole `{"caption": ...}` envelope as
   the caption, so the editor (and its comark preview) showed raw JSON. It now
   imports the shared `extractJsonObject`, and `normalizeDraft` falls back to
   `recoverCaption` (read the caption string value out of the failed payload)
   before `plainText` — a JSON envelope must never become the caption.
- `writePost` needs real token headroom (`maxTokens: 4000`, humanize 2000):
  the draft repeats the caption once per platform variant plus slide copy, so
  a long post with 2+ variants is already 3x the article before JSON framing.
- **Client half, board side:** `displayAngle`
  (`packages/connect/app/utils/content-brief.ts`) applies the same rule to a card's
  brief — trim, collapse, unwrap `brief`/`summary`/`angle`/`title` out of an
  envelope, and return `''` when anything envelope-shaped is left, so the line is
  hidden rather than rendering a truncated fragment. Import it wherever a brief is
  rendered or edited; do not re-implement the unwrap locally. Its invariant —
  never returns a string containing a brace or a bracket — is what
  PRD-CONTENT-PIPELINE-OVERHAUL §10.2 asserts about a rendered brief.

## Verify

- [ ] New/changed functions ≤ 5 branches (count `if`/`else if`/`case`/`catch`/loops/`&&`/`||`/ternary)
- [ ] `tests/carousel-generation.test.mjs` robustness block passes (fences, prose braces, trailing commas, aliases, truncation, retry-once)
- [ ] Full `pnpm --filter @local-monorepo/agent test` green (shared parser feeds ~10 call sites)
- [ ] Error codes unchanged (`CAROUSEL_INVALID`, `REVISE_FAILED`, `GENERATION_FAILED`)

## Debug

- `CAROUSEL_INVALID` persists: log the raw `complete` output — if truncated,
   raise `maxTokens`; if prose-heavy, the repair suffix may need the deck size
   restated; if keys drift, extend `firstString` aliases.
- 0 slides but valid JSON: check `headline` aliases, not the parser.

## Update Scaffold

- [ ] Update `.claude/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.claude/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.claude/patterns/` and add to `INDEX.md`
