---
name: onboard
description: Onboard Claude Code into the codebase - Scan structure, read key files, provide project summary
argument-hint: none
---

# Onboard

## Description
Onboard Claude Code into the codebase. Scan structure, read key files, and provide a project summary including tech stack, organization, and current status.

## Process

1. **Scan structure**
   - Run `git ls-files` to see all tracked files
   - List directory structure

2. **Read key files**
   - `.claude/AGENTS.md` - Project identity and non-negotiables
   - `.claude/ROUTER.md` - Session bootstrap and navigation
   - `.claude/context/architecture.md` - System architecture
   - `PRD.md` - Product requirements
   - `PROGRESS.md` - Current module status
   - `package.json` - Dependencies and scripts

3. **Check state**
   - Run `git status` to see current changes
   - Run `git log -10 --oneline` to see recent activity

4. **Check Python backend** (if exists)
   - Check `python-backend/` directory
   - Look for `requirements.txt` or `pyproject.toml`

5. **Check active PRD implementations**
   - Review `.agent/plans/active/*.md` for in-progress PRDs
   - Mark PRDs as complete when all tasks are done
   - Move completed PRDs to `.agent/plans/done/`

---

## PRD Tracking

### In PROGRESS.md
Track completion status:
- `[ ]` = Not started
- `[-]` = In progress
- `[x]` = Completed

### In Active Plans
Check `.agent/plans/active/*.md` for status field:
- Status: `in_progress`, `complete`, or `pending`
- Move completed PRDs to `.agent/plans/done/` directory
- Create `done` directory if it doesn't exist
- Review each completed PRD for implementation quality

### Implementation Verification
When marking a PRD complete:
1. Verify all implementation matches plan
2. Check for best practices and edge cases
3. Ensure tests pass (run test commands)
4. Verify database migrations are applied

## Output

Provide a brief summary:

- **What this project does** - Brief description
- **Tech stack** - Frontend, backend, database, etc.
- **How it's organised** - Directory structure overview
- **Current branch and recent activity** - Git status and recent commits
- **Progress** - Current module status from PROGRESS.md
- **Build commands** - Relevant dev/build commands

## Example Output Format

```
## Onboard Summary

### What This Is
[1-2 sentence description]

### Tech Stack
- Frontend: [framework]
- Backend: [framework]
- Database: [database]
- Auth: [auth solution]
- AI: [LLM, embeddings]

### Organisation
- `packages/` - Nuxt layer packages
- `python-backend/` - Python FastAPI backend (if exists)
- `.claude/` - AI agent context and patterns

### Current Branch
[branch name] - [n] uncommitted changes

### Recent Activity
[last 3-5 commits]

### Progress
Current module: [Module N: Name]
- [ ] Task 1
- [ ] Task 2

### Build Commands
- `pnpm site:dev` - Start dev server
- `cd python-backend && pnpm dev` - Start Python backend
```
