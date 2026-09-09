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
- Service methods must return `ServiceResponse<T>`, never throw exceptions
- All new Vue components must use Composition API (`<script setup>`)
- Never commit secrets or API keys — use `.env` files only
- Follow the layer package structure — pages go in layer packages, not in site
- Use the nuxt shared/utils || shared/types for types and functions that are re used across layers

## Commands

- **Dev server:** `pnpm dev` — starts on port 3000
- **Build all:** `pnpm build`
- **Build site:** `pnpm site:build`
- **Database:** `cd packages/db && pnpm db:generate` / `db:migrate`
- **TTS assets (HF):** `pnpm tts:assets` — downloads ONNX models + voice styles from HuggingFace into `packages/site/public/assets/` (also runs automatically inside the Docker build)
- **Lint UI:** No lint script configured (available scripts: dev, build, start, clean)

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
   (`if`/`else if`/`case`/`catch`/loops/`&&`/`||`/`??`/ternary each count 1).
   Extract helpers instead of adding branches. No `complexity` eslint rule is
   configured repo-wide yet, so count manually and state the max you found.
2. **i18n** — no hardcoded user-facing strings. Pages/components carry a locale
   JSON alongside (`<i18n src="./x.json">` first line, `const { t } = useI18n()`),
   all copy via `t()` with interpolation (`{name}`, `{count}`), and every used
   key exists in the JSON. Grep template text nodes to prove nothing is left.
3. **Event handlers** — named functions only. Never assign state inline
   (`@click="x = 'y'"` is forbidden, arrow wrappers included).
4. **Conventions checklist** — walk `context/conventions.md` Verify Checklist
   item by item and report each explicitly.
5. **Patterns** — check `patterns/INDEX.md` for a matching pattern and follow
   it; leave no `console.*` or dead code behind.
6. **Interaction feedback** — every user-triggered change shows feedback:
   async buttons carry `:loading`, outcomes raise toasts (failures never
   silent), conditionally rendered UI animates on enter via `@vueuse/motion`
   (see `context/conventions.md` Motion section).