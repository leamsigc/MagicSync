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
last_updated: 2026-03-30
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
- Check `NUXT_TURSO_DATABASE_URL` in .env
- Verify Turso database is accessible

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

