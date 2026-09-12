---
name: research-channels
description: Add a social-research channel (Agent-Reach style) to the Python backend — one file per platform with ordered backends and doctor health
triggers:
  - "research channel"
  - "add platform to research"
  - "agent-reach"
edges:
  - target: "context/conventions.md"
    condition: "when writing the channel code or doctor wiring"
last_updated: 2026-09-12
---

# Research Channels

## Context
Channels live in `packages/python-backend/app/services/research/channels/`. Registry + doctor in `app/services/research/`. API at `GET /api/v1/research/doctor` (auth via `require_user`). Inspired by Agent-Reach: capability layer, not wrapper — agents call upstream tools directly after install.

## Steps
1. Create `channels/<name>.py` with a class extending `Channel`: set `name`, `description`, ordered `backends` (preferred first), `tier` (0=zero-config, 1=needs key/login, 2=complex).
2. Implement `can_handle(url)`. Implement `check()` that **really probes** (run a lightweight command / HTTP hit) and sets `active_backend`; `shutil.which()` alone is not proof.
3. Register instance in `channels/__init__.py` `_CHANNELS` list.
4. Verify with `venv/bin/python -c "from app.services.research import check_all; print(check_all())"`.
5. Run `pytest tests/ -q -k "research or harness"`.

## Gotchas
- `check()` must never raise — `doctor.check_all` guards per-channel, but keep channels clean anyway.
- venv lacks some deps the system python has (e.g. `yt_dlp` needed manual `venv/bin/pip install yt-dlp`). If a channel probes a binary, ensure the venv or PATH provides it.
- `gh` CLI is usually absent on servers — return `off`/`warn` with fallback note, not `error`.
- Backend runs detached (`nohup ... & disown`); a shell timeout kills the process group, so start and health-check in separate bash calls.

## Verify
- [ ] `check_all()` includes the new channel with accurate status
- [ ] `pytest -k "research or harness"` passes
- [ ] `ruff check` passes on new files (repo eslint is broken env-wide: typescript-eslint vs TS 7.0 — pre-existing)
- [ ] Backend boots with new code (`/api/v1/health` 200)

## Debug
- Channel missing from doctor → not added to `_CHANNELS`.
- Stale `active_backend` after failure → always set it in every `check()` branch.
- `ModuleNotFoundError` at boot → missing venv dep; install into `venv/`, not system python.
- New pip dep? Also declare it in `pyproject.toml` optional deps (`harness` group owns `scrapegraphai`), or fresh installs break.
- `scrapegraph` channel tiers: SmartScraperGraph needs an LLM (Ollama local works, no key); without one it degrades to Markdownify → jina-reader automatically. `scraper.extract()` never raises — it returns `{"backend", "result"|"error"}`.
- E2E auth gotcha (Playwright): per-call `cookies` option is silently ignored and each test gets a fresh cookie jar. Build ONE `playwright.request.newContext()` in `beforeAll`, run signup/signin through it, and reuse it for all API calls. Mark state-sharing files `test.describe.configure({ mode: 'serial' })` — `fullyParallel` splits tests across workers.

## Update Scaffold
- New platform tiers or backend swaps: update this file's Steps/Gotchas.
