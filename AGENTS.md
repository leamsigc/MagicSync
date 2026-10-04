---
name: agents
description: Always-loaded project anchor. Read this first. Contains project identity, non-negotiables, commands, and pointer to ROUTER.md for full context.
last_updated: 2026-03-30
---

# MagicSync

## What This Is
A social media scheduling platform built with Nuxt 4 monorepo — enables scheduling posts across multiple social platforms (Facebook, Twitter, Instagram, Bluesky, LinkedIn, etc.) with AI-powered content generation.

## Non-Negotiables

- Never write database queries directly in route handlers — use the service layer in `packages/db/server/services/`
- New and modified service methods must return `ServiceResponse<T>` and must not throw. Legacy methods are grandfathered: only 12 of 53 modules fully comply today, so do not report existing non-compliance as a regression, and do not "fix" it opportunistically inside an unrelated task. See `docs/adr/0001-layer-placement.md`
- Every read and write that touches an owned row must fold ownership into its predicate. 103 of 173 such methods do; the rest are known debt. Do not add a new unscoped one
- All new Vue components must use Composition API (`<script setup>`)
- Never commit secrets or API keys — use `.env` files only
- Follow the layer package structure — product pages go in `packages/site/app/pages/`; feature layers are libraries, not route owners
- Never create `components/`, `composables/` or `utils/` directories inside an `app/pages/` tree — Nuxt scans it for routes and a stray `.ts` file becomes a phantom route
- A layer imports only layers it extends, transitively. This is **machine-checked**: `pnpm audit:layers` runs in CI and fails on any new cross-layer import. 14 known violations are pinned in `scripts/layer-import-baseline.json` — see `docs/adr/0001-layer-placement.md`
- Use the nuxt shared/utils || shared/types for types and functions that are re used across layers

## Domain Language
Read `CONTEXT.md` before naming anything. Architecture words (module, interface, depth, seam, adapter, locality) are not domain terms — see `.claude/patterns/layer-restructure.md` for the architecture vocabulary.

## BEFORE STARTING THE MAIN task:

restate in your own words what you think my goals are and what the problem i'm trying to solve is

## Commands

- **Dev server:** `pnpm dev` — starts on port 3000
- **Build all:** `pnpm build`
- **Build site:** `pnpm site:build`
- **Database:** `cd packages/db && pnpm db:generate` / `db:migrate`
- **TTS assets (HF):** `pnpm tts:assets` — downloads ONNX models + voice styles from HuggingFace into `packages/site/public/assets/` (also runs automatically inside the Docker build)
- **Lint UI:** No lint script configured (available scripts: dev, build, start, clean)
- **Layer audit:** `pnpm audit:layers` — fails on any new cross-layer import (runs in CI). Add `--:strict` to report all known debt, `--:update` after a fix

## Scaffold Growth
After every task: if no pattern exists for the task type you just completed, create one. If a pattern or context file is now out of date, update it. The scaffold grows from real work, not just setup. See the GROW step in `ROUTER.md` for details.

## Navigation
At the start of every session, read `./.claude/ROUTER.md` before doing anything else.
For full project context, patterns, and task guidance — everything is there.

### Do not do ever
The following should be avoided at all costs.
```vue
 @click="audioTab = 'file'"
```
right within the `@click` handler. Instead, ` @click="() => {audioTab = 'file'}"`. or create a handler function in the script block.



### Must do every time (per-task verification gate)
Run these checks after every task, before presenting the result. All must pass:

1. **Cyclomatic complexity** — every new/changed function ≤ 5 branches
   (`if`/`else if`/`case`/`catch`/loops/`&&`/`||`/ternary each count 1;
   `??`/`?.` null-defaults don't count). Extract helpers instead of adding
   branches. No `complexity` eslint rule is configured repo-wide yet, so
   count manually and state the max you found.
2. **Nuxt doctor** — Run `pnpm dlx vite-doctor .` to check for diagnostics and warnings  then fix any errors or warnings.
3. **i18n** — no hardcoded user-facing strings. Pages/components carry a locale
   JSON alongside (`<i18n src="./x.json">` first line, `const { t } = useI18n()`),
   all copy via `t()` with interpolation (`{name}`, `{count}`), and every used
   key exists in the JSON. Grep template text nodes to prove nothing is left.
4. **Event handlers** — prefer named functions; never bare state assignment
   (`@click="x = 'y'"` is forbidden). Arrow wrappers only to forward
   arguments (`@click="saveUser(user.id)"`).
5. **Conventions checklist** — walk `context/conventions.md` Verify Checklist
   item by item and report each explicitly.
6. **Patterns** — check `patterns/INDEX.md` for a matching pattern and follow
   it; leave no dead code behind. No `console.*` in `app/` or `server/` either —
   use the `log` auto-import (`log.error({ message, ...fields })`); Web Workers are
   exempt until they get a transport. See `context/conventions.md` Logging.
7. **Interaction feedback** — every user-triggered change shows feedback:
   async buttons carry `:loading`, outcomes raise toasts (failures never
   silent), conditionally rendered UI animates on enter via `@vueuse/motion`
   (see `context/conventions.md` Motion section).



