---
name: add-mcp-tool
description: Adding a new MCP tool to the site layer's MCP server
triggers:
  - "add mcp tool"
  - "new mcp tool"
  - "expose as mcp"
edges:
  - target: context/conventions.md
    condition: when checking code style requirements
  - target: context/architecture.md
    condition: when understanding where MCP tools live
last_updated: 2026-09-07
---

# Add New MCP Tool

## Context

MCP tools live in `packages/site/server/mcp/tools/<group>/<name>.ts` (file-based,
auto-discovered by `@nuxtjs/mcp-toolkit`, route `/mcp`). They are thin wrappers
around existing service singletons — never new business logic, never raw Drizzle.
Auth context flows via `AsyncLocalStorage` (see Gotchas), NOT via handler args.

## Steps

1. Pick group + filename: `tools/<group>/<tool-name>.ts` (name/title auto-generated
   from filename; group auto-inferred from subdirectory).

2. Write the tool:
   ```typescript
   import { z } from 'zod'
   import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
   import { someService } from '#layers/BaseDB/server/services/some.service'
   import { requireMcp, requireScope, resolveUserId } from '../../utils/mcp-context'
   import { logMcpCall } from '../../utils/mcp-audit'

   export default defineMcpTool({
     description: 'What it does, in agent-actionable language.',
     inputSchema: {
       someId: z.string().describe('...'),
     },
     enabled: event => !!event.context.mcp?.valid, // hide from anonymous callers
     annotations: { readOnlyHint: true }, // or destructiveHint: true for writes
     async handler(args) {
       const mcp = requireMcp() // valid ApiKeyContext or friendly error (never 401)
       requireScope(mcp, 'full') // writes only; omit for reads
       const userId = await resolveUserId(mcp) // key userId, else first account owner
       const result = await someService.doThing(userId, { businessId: mcp.businessId, ... })
       if (!result.success) throw new Error(result.error || 'Failed')
       await logMcpCall(mcp, 'tool-name', result.data.id) // writes + previews only
       return { /* shaped, JSON-safe output */ }
     },
   })
   ```

3. Rules:
   - `businessId` ALWAYS comes from `mcp.businessId` (key-bound), never from args.
   - Platform names use the shared `PLATFORMS` enum (`utils/platforms.ts`, 17 canonical
     values); map to account IDs via `resolveAccounts()` — `PostService.targetPlatforms`
     takes ACCOUNT IDs, not names.
   - Reads: `findByIdFull` (org-member path) + `post.businessId !== mcp.businessId` check.
     Never use unscoped getters (`getPlatformPostsByPost`) without a binding check.
   - Writes: `resolveAccounts()` enforces key allowlist + connected-check.
   - Errors: plain `Error` (friendly text) or h3 `createError` — NEVER 401 (triggers
     MCP OAuth discovery).

4. Verify: dev boot shows tool count bump (`[@nuxtjs/mcp-toolkit] ✔ /mcp enabled with N tools`),
   then `tools/list` (anon → hidden) and `tools/call` with a real org key:
   ```bash
   curl -s localhost:3000/mcp -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -H "Authorization: Bearer $MCPKEY" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{}}}'
   ```

## Gotchas

- NO `useEvent()` from h3 — h3 v1 doesn't export it and the toolkit never forwards
  the H3 event to tool handlers. Auth context comes from `utils/mcp-request.ts`
  AsyncLocalStorage (set by `server/mcp/index.ts` middleware wrapping `next()`).
- `inputSchema` is a PLAIN OBJECT of zod schemas, not `z.object()`. Handler receives
  `(args, extra)` — `args` is the validated input directly.
- `PostService.create/update` status games: service always writes `pending`; a
  non-`pending` label bypasses the future-scheduledAt validation (precedent:
  `cli/post.post.ts`). Cast: `as PostCreateBase['status']`.
- `findByBusinessId` hard-filters by `userId` — org-level keys only see the fallback
  owner's posts (known v1 limitation, tracked in PRD).
- Correct dev boot is root `pnpm site:dev` (dotenv loads repo-root `.env`); booting
  site directly falls back to `file:../../local.db`.
