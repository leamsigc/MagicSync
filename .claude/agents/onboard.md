---
name: onboard
description: Onboard Claude Code into the codebase - Scan structure, read key files, provide project summary
argument-hint: none
---

# Onboard

## Description
Onboard Claude Code into the codebase. Scan structure, read key files, and provide a project summary including tech stack, organization, skills, and current status.

## Process

1. **Scan structure**
   - Run `git ls-files` to see all tracked files
   - List directory structure

2. **Read key files**
   - `.claude/AGENTS.md` - Project identity and non-negotiables
   - `.claude/ROUTER.md` - Session bootstrap and navigation
   - `.claude/context/architecture.md` - System architecture
   - `.claude/context/stack.md` - Tech stack details
   - `.claude/context/conventions.md` - Code conventions
   - `.claude/context/decisions.md` - Architectural decisions
   - `.claude/context/setup.md` - Development environment setup
   - `README.md` - Project overview and features
   - `package.json` - Dependencies and scripts

3. **Check state**
   - Run `git status` to see current changes
   - Run `git log -10 --oneline` to see recent activity

4. **Check available skills**
   - Review skills in `.config/opencode/skills/`
   - Review skills in `.claude/skills/`
   - Note relevant skills for the current project focus

5. **Check Python backend** (if exists)
   - Check `python-backend/` directory
   - Look for `requirements.txt` or `pyproject.toml`

6. **Check active implementations**
   - Review `.agent/plans/active/*.md` for in-progress work
   - Mark completed work when all tasks are done
   - Move completed plans to `.agent/plans/done/`

---

## Available Skill

MagicSync has one specialized skill:

| Skill | Purpose |
|-------|---------|
| **magic-sync** | Create, schedule, and manage social media posts across platforms (Facebook, Twitter/X, Instagram, Bluesky, LinkedIn, TikTok, etc.) |

**Skill triggers:** "create social media post", "schedule post", "post to twitter", "post to instagram", "post to facebook", "social media", "cross-post"

To use the skill, ask the user to load it with `/magic-sync` or trigger one of the keywords above.

---

## Output

Provide a brief summary:

- **What this project does** - Brief description
- **Tech stack** - Frontend, backend, database, etc.
- **How it's organised** - Directory structure overview
- **Available skills** - Skills that can be loaded for this project
- **Current branch and recent activity** - Git status and recent commits
- **Progress** - Current module status
- **Build commands** - Relevant dev/build commands

## Example Output Format

```
## Onboard Summary

### What This Is
MagicSync is a social media scheduling platform built with Nuxt 4 monorepo.
It enables scheduling posts across Facebook, Twitter/X, Instagram, Bluesky,
LinkedIn, and more with AI-powered content generation.

### Tech Stack
- Frontend: Nuxt 4, Vue 3, @nuxt/ui
- Backend: Nuxt Server Routes, Better Auth
- Database: Turso (libSQL) with vector support
- AI: LLM integration for content generation
- Python Backend: FastAPI (optional, port 8000)

### Organisation
- `packages/` - Nuxt layer packages (db, auth, scheduler, connect, etc.)
- `packages/site/` - Main application (layer merge point)
- `python-backend/` - Python FastAPI backend (if used)
- `.claude/` - AI agent context, patterns, and skills
- `.config/opencode/skills/` - Agent skills

### Available Skill
- **magic-sync**: Social media post creation, scheduling, and management across multiple platforms

### Current Branch
[branch name] - [n] uncommitted changes

### Recent Activity
[last 3-5 commits]

### Progress
Current focus: [module/feature]
- [x] Completed task 1
- [-] In progress: task 2
- [ ] Pending: task 3

### Build Commands
- `pnpm site:dev` - Start dev server (port 3000)
- `pnpm build` - Build all packages
- `cd packages/db && pnpm db:generate` - Generate database schema
- `cd python-backend && pnpm dev` - Start Python backend (port 8000)
```