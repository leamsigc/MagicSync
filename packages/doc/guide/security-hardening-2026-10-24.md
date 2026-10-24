# Security Hardening — 2026-10-24 Audit

This page records the full security audit of the MagicSync monorepo and the
fixes that shipped with it. It exists so the next person can see **why** each
guard is where it is, not just that it exists.

## What was wrong (short version)

The application had good bones — one auth gate, Drizzle everywhere, HMAC-signed
machine callbacks, an SSRF allowlist already written — but three structural
problems undid most of that value:

1. **One-hop SSRF validation.** `isSafeExternalUrl()` checked the URL it was
   given, then `fetch(url, { redirect: 'follow' })` followed any redirect.
   A public URL that 302s to `http://169.254.169.254/` walked straight through.
   Worse, it was reachable **without a session** via `/api/v1/podcast/audio`.
2. **String-concatenated HTML.** Google review text (attacker-controlled by
   anyone who can review a business) was interpolated into an HTML document
   served as `text/html` and also injected with `document.write`.
3. **Encryption that wrote plaintext next to it.** `social_media_accounts`
   stored `access_token` (plaintext) *and* `access_token_encrypted`. A leaked
   DB gave away every connected social account.

Plus the usual: no security headers, no rate limiting, wildcard CORS, a root
container, arbitrary upload extensions, and 25 dependency advisories.

## What changed

### 1. `safeFetch` — connection-pinned, redirect-aware

`packages/shared/server/utils/ssrf.ts` now exports:

| Export | Purpose |
|---|---|
| `isSafeExternalUrl` | Pre-flight check only (kept for callers that need it) |
| `validateOutboundUrl` | Resolve + validate one hop |
| `safeFetch` | Buffered fetch: pinned IP, manual redirects (max 3), byte cap |
| `safeFetchStream` | Streaming variant (podcast audio) |
| `capStream` | Abort a stream past `maxBytes` |
| `isBlockedIp` | Shared range check (v4 + v6, incl. IPv4-mapped) |

Why pinning matters: `dns.lookup` at validation time and `connect()` at request
time are two separate resolutions. An attacker who controls DNS answers
`1.2.3.4` (public) for the check and `127.0.0.1` (TTL 0) for the connection.
Pinning uses `http.request(..., { lookup })` with a function that always
returns the pre-validated address, so there is no second lookup to poison.

Every request-derived outbound URL now goes through it:
`podcast/audio`, `podcast/feed`, `scrapePublicPage`, `assetService.createFromUrl`,
`POST /api/v1/assets` URL import, and Pexels download.

### 2. Escaped review HTML + sandboxed preview

`generateReviewScreenshotHTML()` escapes `authorName`, `content` and
`businessName`, and restricts `authorImage` to `https://*.googleusercontent.com`.
The route sends `Content-Security-Policy: … sandbox` and `nosniff`. The Vue
preview uses `<iframe sandbox="">` (no `allow-scripts`) instead of `v-html` +
`document.write`.

### 3. Tokens encrypted at rest, hydrated at the boundary

- Writes persist **only ciphertext** (`accessToken` / `refreshToken` columns
  now hold the encrypted value; the `*_encrypted` columns are kept in sync for
  compatibility).
- `getAccountById`, `getAccounts` and `getAccountsByIds` hydrate plaintext into
  the in-memory object — plugins keep receiving a usable bearer token.
- `decryptKey()` returns `null` instead of throwing on a legacy plaintext row.
- `tokens:encrypt` (daily, 03:30) migrates any rows written before the fix.

### 4. Auth and session hardening

- `accountLinking.allowDifferentEmails: false` — a provider identity with a
  different email can no longer be auto-linked to an existing user.
- PKCE enabled on every `genericOAuth` provider.
- Threads access token moved from the query string to `Authorization: Bearer`.
- `x-forwarded-for` is only trusted when `NUXT_TRUST_PROXY=1`; otherwise audit
  IPs come from `x-real-ip` / the socket.
- Anonymous MCP dynamic client registration is off unless
  `NUXT_MCP_ALLOW_ANON_DCR=1`.

### 5. Deny-by-default API gate

`packages/auth/server/middleware/001.auth.ts` used to gate only `/api/v1`.
`/api/ai-tools/**` and `/api/a2ui/**` were protected solely by a call inside
each handler. The gate now matches every `/api/*` path, with an explicit
allowlist (`/api/auth`, `/api/_`, the six public product endpoints, and the
API-key CLI prefix). Prefix matching is segment-aware (`path === p ||
path.startsWith(p + '/')`), so `/api/v1/assets/publicX` no longer matches
`/api/v1/assets/public`.

### 6. Rate limiting

`packages/auth/server/middleware/003.rate-limit.ts`, per-instance windows:

| Bucket | Limit |
|---|---|
| `/api/auth/sign-in|sign-up|forget-password|reset-password` | 10 / min per IP |
| `/api/v1/agent`, `/api/ai-tools` | 20 / min per user |
| uploads (`/assets`, `/documents/upload`, `/media` POST/PUT) | 10 / min |
| everything else under `/api` | 120 / min |

Swap `hit()` for Redis if you need a global limit across replicas.

### 7. Headers, CORS, container

- Baseline security headers + CSP in `packages/site/nuxt.config.ts` (CSP keeps
  `'unsafe-inline'` for Nuxt hydration; `object-src`, `base-uri`,
  `frame-ancestors` and `form-action` still bite).
- `cors: true` removed from `/api/v1/**` — the app is same-origin.
- Docker runtime runs as `app`, not root, and only `/app/video-tmp` is writable.
- `python-tools` refuses to start without `PYTHON_TOOLS_TOKEN`, has no CORS by
  default, no published host port, constant-time bearer check, and validates
  every outbound URL.

### 8. Uploads and file serving

- Extension allowlist (`jpg/jpeg/png/gif/webp/svg/mp4/webm/mov/avi/mkv/pdf/txt`),
  MIME derived from the extension (never `part.type`), 25 MB image / 250 MB
  video caps, max 20 files per request.
- Private files are `Cache-Control: private` (they were `public`, which let a
  shared cache hand one user's asset to another).
- Path traversal now uses `resolve()` + prefix comparison instead of
  `path.replace(/\.\./g, '')`.

### 9. Dependencies

Overrides in `pnpm-workspace.yaml` pin `undici`, `body-parser`, `fast-uri`,
`serialize-javascript`, `happy-dom` and `@modelcontextprotocol/client` to
patched versions. `pnpm audit --prod` dropped from **25** advisories to **3**:

| Remaining | Why it stays |
|---|---|
| `node-forge` | Build-time only (`listhen`), **no patch published** |
| `zod <4.6.6` | v3 line has no patch; forcing v4 breaks `@nuxt/content` / `@atproto` |
| `esbuild 0.18` | Dev tooling via `drizzle-kit`; advisory targets the dev server |

## Second pass (re-audit of the fixes)

The fixes became the new attack surface, so they were audited again. What the
second pass found and fixed:

| ID | Issue | Fix |
|---|---|---|
| R-01 | **IPv4-mapped IPv6 bypassed the SSRF guard** — `::ffff:7f00:1` / `::ffff:a9fe:a9fe` (hex form) returned "allowed" because only the dotted form was matched | `isBlockedIp` now expands IPv6 into hextets, decodes `::ffff:0:0/96`, `::ffff:0:0:0/96`, `64:ff9b::/96` (NAT64) and `2002::/16` (6to4) back to IPv4, and treats unparseable IPv6 as blocked. Brackets are stripped before `isIP()`. `url-allowlist.ts` now imports this one implementation instead of keeping a second copy |
| R-02 | `x-real-ip` was trusted unconditionally → fresh rate-limit bucket per request | New `000.ip-headers.ts` strips all forwarding headers unless `NUXT_TRUST_PROXY=1`; the limiter and audit log read the socket address otherwise |
| R-03 | Bluesky / dev-null pre-encrypted, then the service encrypted again (`enc(enc(secret))`) | Callers pass plaintext; `tokens:encrypt` normalises existing double-encrypted rows |
| R-04 | `happy-dom` override recorded but not applied — audit green while 21.0.3 ran | Catalog bumped to 21.0.4 and verified with `pnpm why`, not the audit exit code |
| R-05 | `safeFetch` had only an idle timeout (slow-drip held sockets forever) | `AbortController` with an absolute `deadlineMs` (30 s buffered, 120 s streaming) |
| R-06 | Connect routes returned the encrypted token columns | `sanitizeSocialMediaAccount()` on all three returns |
| R-07 | MCP `run-goal` ran without `mcp:full` and claimed `readOnlyHint: true` | `requireScope(mcp,'full')`, `readOnlyHint: false` |
| R-08 | `/api/_*` was blanket-public | Narrowed to `/api/_nuxt_*` and `/api/_content` |
| R-09 | `update-profile` validated and ignored `email`; `image` accepted `javascript:` | `email` optional/unused with a comment; `image` must be `https:` or a local path; error message no longer echoes internals |
| R-10 | CSV formula injection in the analytics export | Cells starting `= + - @ tab CR` are prefixed with `'` |
| R-11 | Root-owned `video-tmp` volume; empty local secrets; `Accept-Ranges` without `Range` | Entrypoint chowns the volume then `su-exec app`; local machine secrets generated; `Range` forwarded with 206 + `Content-Range` |

### Regression check for R-01

```
::ffff:7f00:1            → blocked
::ffff:a9fe:a9fe         → blocked
0:0:0:0:0:ffff:7f00:1    → blocked
64:ff9b::a9fe:a9fe       → blocked   (NAT64)
2002:a9fe:a9fe::1        → blocked   (6to4)
[::1]                    → blocked
8.8.8.8                  → allowed
2606:4700:4700::1111     → allowed
::ffff:808:808           → allowed   (8.8.8.8, public)
```

## Verification

```bash
pnpm install
pnpm audit --prod            # 3 advisories, all documented above
pnpm audit:layers            # 0 new cross-layer imports
pnpm packages @local-monorepo/site exec nuxt prepare
pnpm site:build
```

## Operational checklist after deploying

1. Set `PYTHON_TOOLS_TOKEN`, `MACHINE_BRIDGE_SECRET`, `NUXT_PUBLISH_SECRET`
   (`openssl rand -hex 32`).
2. Set `NUXT_TRUST_PROXY=1` **only** if your proxy overwrites `x-forwarded-for`.
3. Run or wait for `tokens:encrypt`, then rotate every social token that was
   stored in plaintext before this release.
4. If a desktop MCP client cannot register, set `NUXT_MCP_ALLOW_ANON_DCR=1` and
   accept the trade-off consciously.
5. If a local Ollama/llama.cpp server is not on localhost, add it to
   `NUXT_LOCAL_LLM_HOSTS`.

## Known follow-ups (deliberately not done here)

- CSP nonce strategy (removes `'unsafe-inline'` from `script-src`).
- Distributed rate limiting (Redis) for multi-replica deployments.
- Replace the remaining `v-html` surfaces (menu board, carousel) with a
  sanitizer; they render user-owned content today and a CSP already limits the
  blast radius.
- `zod` v3 → v4 migration once `@atproto/api` supports it.
