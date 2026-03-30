---
name: agents
description: Always-loaded project anchor. Read this first. Contains project identity, non-negotiables, commands, and pointer to ROUTER.md for full context.
last_updated: 2026-03-30
---

# MagicSync

## What This Is
A social media scheduling platform built with Nuxt 4 monorepo — enables scheduling posts across multiple social platforms (Facebook, Twitter, Instagram, Bluesky, LinkedIn, etc.) with AI-powered content generation.

## Current Focus: Agentic RAG Layer

We are building an Agentic RAG layer that enables:
- Chat with AI using TanStack AI
- AI-powered post generation via dynamic skills
- Document ingestion with local embeddings (Ollama)
- Platform research capabilities
- Target audience extraction from business documents

**Database:** Using Turso (libSQL) with native vector support - no separate PostgreSQL needed

**See [PROGRESS.md](./PROGRESS.md) for current module status.**

## Non-Negotiables

- Never write database queries directly in route handlers — use the service layer in `packages/db/server/services/`
- Service methods must return `ServiceResponse<T>`, never throw exceptions
- All new Vue components must use Composition API (`<script setup>`)
- Never commit secrets or API keys — use `.env` files only
- Follow the layer package structure — pages go in layer packages, not in site

## Commands

- **Dev server:** `pnpm site:dev` — starts on port 3000
- **Build all:** `pnpm build`
- **Build site:** `pnpm site:build`
- **Database:** `cd packages/db && pnpm db:generate` / `db:migrate`
- **Lint UI:** `pnpm ui:lint`
- **Python backend:** `cd python-backend && pnpm dev` — starts FastAPI on port 8000

## Session Commands

- **Onboard:** `/onboard` — Scan codebase structure, read key files, provide project summary
- **Build from plan:** `/build link-to-plan` — Execute a saved plan with validation

## Scaffold Growth
After every task: if no pattern exists for the task type you just completed, create one. If a pattern or context file is now out of date, update it. The scaffold grows from real work, not just setup. See the GROW step in `ROUTER.md` for details.

## Navigation
At the start of every session, read `ROUTER.md` before doing anything else.
For full project context, patterns, and task guidance — everything is there.

