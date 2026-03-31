<!-- Copilot instructions for AI coding agents working on MagicSync -->
# Copilot instructions — MagicSync (monorepo)

Goal: help an AI coding agent become productive quickly in this pnpm/Nuxt monorepo.

- Big picture: This is a Nuxt-based monorepo with workspace packages under `packages/*`. Key layers are: `db`, `auth`, `assets`, `scheduler`, `connect`, `tools`, `ai-tools`, `bulk-scheduler`, `content`, `site`, `ui`, `email`, `doc`. The root orchestrates per-layer commands via `pnpm` scripts in `package.json`.

- How to run and common workflows:
  - Use the repo `pnpm` commands. The root `package.json` exposes shortcuts like `pnpm packages ui dev`, `pnpm packages site dev`, `pnpm packages db db:migrate`.
  - Install: `pnpm i` (root). Project uses `pnpm@10.x` and workspaces configured at `packages/*`.
  - DB setup (from README): `pnpm packages db db:generate` then `pnpm packages db db:migrate`.
  - Per-layer dev: `pnpm packages [layer] dev` (example: `pnpm packages ui dev`). Production start: `pnpm packages [layer] start`.
  - Docker: repository includes `docker-compose.yml` and `docker-compose.dev.yml` for containerized runs; prefer local `pnpm` devs for iterative dev unless reproducing production.

- Environment and important globals:
  - Check `config/env.config.ts` for required env vars. Notable required keys: `NUXT_TURSO_DATABASE_URL`, `NUXT_TURSO_AUTH_TOKEN`, `NUXT_PEXELS_API_KEY`.
  - There is an expected `.env` (use `.env-example` if present). Many layer dev scripts rely on `dotenv-cli` (devDependency).

- Repo conventions and patterns to follow when changing code:
  - Nuxt Layers: each package is a Nuxt layer with `app/`, `server/`, `translations/` or `content/` subfolders. Keep server/api logic inside the package's `server/` directory.
  - UI components: shared UI in `packages/ui` uses Nuxt UI. Components exported with a `Base-` prefix (example: `BaseButton.vue`) act as proxies to upstream Nuxt UI components — preserve prefix and API when adding components.
  - Package config files follow `*.config.ts` (many packages include `app.config.ts` and `nuxt.config.ts`). Prefer editing the package-level `nuxt.config.ts` when adjusting behavior for a layer.
  - Layer scripts: use the root `pnpm` helpers (eg `pnpm packages ui dev`) rather than running package-local scripts directly — this preserves the workspace environment and dotenv usage.

- Testing & CI:
  - Some packages include test configs: `vitest.config.ts` and `playwright.config.ts` (see `packages/bulk-scheduler`). Run package tests using the package's npm script or `pnpm -w test` if orchestrated.
  - GitHub Actions workflows live in `.github/workflows/` (e.g., `build-docker-image.yml`, `doc-deploy.yml`). Keep changes compatible with those CI steps.

- What to change in PRs and how to format suggestions:
  - Small, focused PRs that change a single layer are preferred. Update the layer `README.md` under `packages/<layer>/README.md` when changing dev/start instructions.
  - When suggesting code, reference the package path (example: `packages/ui/app/components/BaseButton.vue`) and prefer edits inside that package unless cross-layer changes are required.

- Useful files to inspect for context:
  - Root: `package.json` (scripts, workspace settings) — see scripts prefixed with `site`, `ui`, `db`, etc.
  - `config/env.config.ts` — required environment variables.
  - `README.md` — project architecture and run instructions.
  - Representative layers: `packages/ui`, `packages/site`, `packages/db`, `packages/auth`.

- Examples you can use when producing code or fixes:
  - Start UI dev server: `pnpm packages ui dev`
  - Run DB migrations: `pnpm packages db db:migrate`
  - Build site: `pnpm packages site build`

If anything in this document is unclear or you want more detail for a specific layer (for example, how `connect` integrates external platform adapters), tell me which layer and I will expand the instructions.
IMPORTANT:
- need to follow the rules base on the /.rules
