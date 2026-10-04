---
name: debug-api
description: Debugging API endpoint failures
triggers:
  - "debug api"
  - "api error"
  - "endpoint not working"
edges:
  - target: patterns/add-endpoint.md
    condition: when fixing an endpoint implementation issue
  - target: context/conventions.md
    condition: when checking error handling patterns
  - target: context/architecture.md
    condition: when understanding the request flow
last_updated: 2026-09-23
---

# Debug API Failures

## Context

API endpoints can fail at multiple points: route handler, service layer, database, or external API. This pattern helps diagnose where the failure occurs.

## Steps

1. Check the error response:
   - 400/422 — Validation error, check request body
   - 401 — Unauthorized, check auth middleware
   - 404 — Route not found, verify file name
   - 500 — Server error, check logs

2. Enable debug logging in the handler:
   ```typescript
   export default defineEventHandler(async (event) => {
     console.log('Request:', event.path)
     console.log('Body:', await readBody(event))
     // ... handler code
   })
   ```

3. Check service error:
   - Verify service returns `{ error: string }` not thrown exception
   - Check service logs for database errors

4. Check database:
   - Run `pnpm db:studio` to inspect data
   - Verify schema matches what service expects

5. Check external APIs:
   - Social media OAuth tokens may be expired
   - API rate limits may be hit

## Common Issues

**"Cannot read property of undefined":**
- Check `event.context.user.id` exists (auth issue)
- Check request body was parsed with `readBody(event)`

**Service returns error:**
- Check `.error` property is checked before `.data`
- Log the full service response to see error message

**Database connection error:**
- Check `NUXT_TURSO_DATABASE_URL` in .env (dev points at the local sqld on `http://localhost:8080`)
- Verify Turso database is accessible

**Generic service failure with no detail (e.g. `Failed to submit artifact`):**
- The service's `catch {}` swallowed the real error. Check the server console — a bare catch
  logs nothing, so add `catch (error) { console.error('<service>.<method> failed:', error) }`
  (the convention used across `packages/db/server/services/*`) and retry.
- Very often the cause is a **pending migration** on the dev DB. Drizzle's `db:migrate`
  compares timestamps: it re-applies only journal entries whose `when` is newer than the
  last row in `__drizzle_migrations`, so a DB that is behind still reads/writes fine until a
  query touches a new column.
- Diagnose without guessing (local sqld, read-only):
  ```bash
  cd packages/db && node --env-file=../../.env --input-type=module -e "
    const { createClient } = await import('@libsql/client')
    const c = createClient({ url: process.env.NUXT_TURSO_DATABASE_URL, authToken: process.env.NUXT_TURSO_AUTH_TOKEN })
    const cols = await c.execute('PRAGMA table_info(content_artifacts)')
    console.log(cols.rows.map(r => r.name).join(', '))
    const last = await c.execute('SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1')
    console.log('last applied:', new Date(Number(last.rows[0].created_at)).toISOString())
  "
  ```
  Compare those columns / that timestamp against `db/migrations/meta/_journal.json`; apply the
  missing entries with `pnpm db:migrate:local` (loads `../../.env`).
- A missing column surfaces as a failure **only when the query references it** — e.g.
  `.returning()` with no args selects every column, so an INSERT can fail on a column the
  read paths never touch.

**Hot reload not seeing changes:**
- Rebuild: `pnpm build`
- Check file is in correct layer package

## Verify

- [ ] Error is properly handled (no uncaught exceptions)
- [ ] Service returns `ServiceResponse` with `.error` on failure
- [ ] API route checks for `.error` and throws appropriate HTTP error
- [ ] Frontend handles errors with toast notification

## Debug Checklist

- [ ] Check browser console for client errors
- [ ] Check server terminal for server errors
- [ ] Verify request URL is correct
- [ ] Verify request method matches file (POST = .post.ts)
- [ ] Check auth token is being sent
- [ ] Verify service is imported with correct alias
- [ ] Check database is accessible

