---
name: security-audit
description: Full-stack security audit of the monorepo — SQLi, path traversal, SSRF, IDOR, secrets, infra. Produces SECURITY_REPORT.html.
triggers:
  - "security audit"
  - "audit security"
  - "find vulnerabilities"
  - "security issues"
edges:
  - target: context/architecture.md
    condition: when mapping the attack surface (which layers/routes exist)
  - target: context/stack.md
    condition: when understanding auth/DB/SSR specifics
  - target: ../AGENTS.md
    condition: before starting — non-negotiables apply to audit output too
last_updated: 2026-08-16
---

# Security Audit

## Context
MagicSync is a Nuxt 4 monorepo: `packages/site` extends 12 layer packages. Request flow: Browser → site → API routes in layer packages → services in `db` package → Drizzle → Turso. Auth is Better Auth; middleware `packages/auth/server/middleware/001.auth.ts` gates `/api/v1/*` except public prefixes (`/assets/public`, `/podcast/*`) and `/api/v1/cli` (API-key via `0001.api-key-auth.ts`). The Python FastAPI backend is a separate package — confirm with the user whether it is in scope.

## Steps
1. **Read the router** (`.claude/ROUTER.md`) and `AGENTS.md` first.
2. **Map the surface:** `git ls-files | grep server/` to enumerate every route; note the auth middleware allowlist (public routes are the highest-value targets).
3. **Audit in parallel focus areas** (spawn explore sub-agents to parallelize):
   - SQLi / raw SQL in `packages/db/server/services/*` (Drizzle `sql\`\`` templates, `tursoClient.execute`).
   - Path traversal + arbitrary file read/delete: asset serve routes, `AssetsUtils.getFileFromAsset`, delete handlers.
   - SSRF: every server-side `fetch`/`$fetch` whose URL comes from request body/query/params (podcast, scraper, asset import, Pexels, Canva, CLI media).
   - IDOR/authz: route handlers operating on `[id]`/`businessId` without ownership checks; OR-conditions in service queries.
   - Secrets & logging: hardcoded fallback secrets, token logging, tokens returned to clients, Docker as root, wildcard CORS, exposed db ports.
4. **Verify the Critical/High findings yourself** by reading the actual files — do not trust agent output for the headline items.
5. **Compile** `SECURITY_REPORT.html` in the repo root: summary stats, grouped findings (file + line, snippet, severity, concrete fix), a "verified safe" section, and a phased remediation order.

## Gotchas
- The auth middleware allowlist (`001.auth.ts:6`) is the map of public routes — podcast `audio`/`feed` were unauthenticated SSRF in this audit; re-check it every time.
- `path.join` silently normalizes `..` — any serve route must use `basename()` + a resolved-path containment check.
- Better Auth returns raw OAuth tokens from `getAccessToken`; logging or returning full account rows leaks them (schema has unused `*Encrypted` columns — use them).
- OR-conditions in `findMany` (`or(eq(businessId), eq(userId))`) look scoped but are cross-tenant.
- Do NOT print full secret values in the report — redact to first chars.

## Verify
- Every Critical/High finding has a file:line, a code snippet, and a concrete fix.
- Report references the working-tree line numbers current at audit time.
- No real secrets appear in the report.
- Positive findings (verified-safe areas) are included so remediation effort is targeted.

## Debug
- If an agent's finding can't be reproduced, read the file and trace the data flow (route → service → DB) before trusting it.

## Update Scaffold
- [ ] Regenerate `SECURITY_REPORT.html` when the audit is re-run; it is a build artifact, not a tracked doc.