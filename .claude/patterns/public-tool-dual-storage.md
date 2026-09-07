---
name: public-tool-dual-storage
description: Public tools pages where guests persist data locally (IndexedDB) and logged-in users persist to the database, plus opt-in public sharing via a slug URL
triggers:
  - "public tool"
  - "guest storage"
  - "indexeddb"
  - "share public link"
  - "dual storage"
edges:
  - target: patterns/add-endpoint.md
    condition: when adding the tool's CRUD API endpoints
  - target: patterns/add-service.md
    condition: when adding a db-backed service
  - target: context/conventions.md
    condition: when writing any new code
last_updated: 2026-08-23
---

# Public Tool with Dual Storage (IndexedDB / Database) + Public Sharing

## Context

Tools in `packages/tools` are public (no auth wall), but some tools let users save work. Pattern established by the Dynamic Menu Board (`packages/tools/app/pages/tools/menu-board/`):

- **Guest** → IndexedDB on their device
- **Logged-in** → database via `/api/v1/<tool>` endpoints (service layer)
- **Share** → database-only feature: publishes a read-only snapshot reachable at a public URL

## Steps

### 1. Server side (db package)

Store tool payloads as JSON rows in the **generic `entity_details` table** instead of new tables:

- Ownership row: `entityType='menu_board'`, `entityId='<userId>::<boardId>'`, `details={...payload}`
- Public snapshot row: `entityType='menu_board_public'`, `entityId=<slug>`
- Service in `packages/db/server/services/<tool>.service.ts` must return `ServiceResponse<T>`, never throw. See `menu-board.service.ts`.

The auth layer's global middleware (`packages/auth/server/middleware/001.auth.ts`) blocks `/api/v1/*` unless whitelisted. **Add the public read route prefix** to `publicApiPrefixes` (e.g. `/api/v1/menu-board/public`). Everything else stays 401 for guests.

Endpoints in `packages/tools/server/api/v1/<tool>/`: `index.get|post`, `[id].delete`, `[id]/share.post`, `public/[slug].get`. Auth via auto-imported `checkUserIsLogin(event)` (requires `@local-monorepo/auth` in tools' `extends`).

Paid features (e.g. LLM generation) must call `checkUserIsLogin` in the handler and use `toolsUnifiedAI.generateText({ ..., userId })` from `packages/tools/server/utils/toolsUnifiedAI.ts` — it resolves the system default provider (env key) with per-user override via `userLlmConfigService`.

### 2. Client side (tools package)

- IndexedDB helper in `app/utils/<tool>-db.ts` using `idb` (already a catalog dep)
- One composable (`app/composables/use<Tool>.ts`) owns all state via `useState` keys and branches persistence on `UseUser().loggedIn` — components never know which backend is active
- **CRITICAL:** deep-clone payloads to plain objects before writing to IndexedDB (`JSON.parse(JSON.stringify(x))`) — Vue reactive proxies throw `DataCloneError`
- Capture `useToast()` once inside the composable body (setup context), not inside async methods
- UI gating: share/save-to-cloud buttons render disabled with a login tooltip for guests; paid features (AI assistant, asset picker) hidden behind `loggedIn`

### 3. Public viewer page

`pages/<tool>/shared/[slug].vue` fetches `public/[slug]` with `useFetch` (SSR-friendly), renders the content read-only and includes a prominent fullscreen control. Use `pages/<tool>/utils/fullscreen.ts` helpers (standard + webkit fallbacks for Safari/iPad TVs).

## Gotchas

- Nuxt UI v4 puts `data-testid` directly on the native `<input>` for UInput without slots — test `[data-testid="x"]`, not `[data-testid="x"] input`
- UBlogPosts card links are zero-height overlays — click the parent element or assert `toBeAttached` in e2e tests
- Adding a layer to `extends` requires restarting dev servers (config-level change, no HMR)
- Playwright `webServer` reuses whatever runs on port 3000; concurrent dev-server rebuilds cause flaky `net::ERR_ABORTED` navigations — keep `retries` ≥ 1

## Verify Checklist

- [ ] Service returns `ServiceResponse<T>`, never throws
- [ ] Public route prefix whitelisted in auth middleware; all other routes still 401
- [ ] Guest CRUD works end-to-end against IndexedDB (persist across reload)
- [ ] Logged-in CRUD hits the service-backed endpoints
- [ ] Share toggle only visible/enabled for logged-in users; public URL renders without auth
- [ ] Paid features gated by login
- [ ] e2e spec covers guest CRUD, display mode, share gating, unknown slug
