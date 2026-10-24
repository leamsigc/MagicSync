---
name: security-audit
description: Run a full security audit of MagicSync (auth, API surface, SSRF, HTML sinks, token storage, uploads, dependencies) and fix what it finds. Use when asked to "audit security", "find vulnerabilities", "do a pentest", "check for SSRF/XSS/IDOR", "review auth", or when a CVE/0-day report needs to be verified against this codebase.
---

# Security Audit (MagicSync)

A repeatable, evidence-first audit. The goal is not a checklist of scary words —
it is a **reachable exploit path** with a file:line, or a documented "not
exploitable because X".

## When to use

- A security review is requested, or a report claims a vulnerability here.
- A new public route, proxy, upload path, or third-party content renderer lands.
- After a dependency advisory lands in CI.

## Rules

1. **Unauthenticated first.** Enumerate what an anonymous request can reach
   *before* looking at authenticated code — that is where CVSS ≥ 9 lives.
2. **Read the middleware, not the handler.** One gate (`001.auth.ts`) covers
   `/api/*`. Anything outside it needs its own proof.
3. **Every finding needs a sink→source line.** "Looks risky" is not a finding.
4. **Prove the guard fails.** If a validator exists, check redirects, DNS
   rebinding, encodings, and path normalisation before calling it fixed.

## Steps

### 1. Map the unauthenticated surface

```bash
# Routes outside /api/v1 (the old gate) and routes that bypass the gate
find packages -path '*/server/api/*' -name '*.ts' | grep -v '/server/api/v1/'
find packages -path '*/server/routes/*' -name '*.ts'
sed -n '1,40p' packages/auth/server/middleware/001.auth.ts   # allowlist
```

For each: does it call `checkUserIsLogin` / `aiToolsFacade.authenticate` /
`apiKeyService.verify*`, or is it public by design (share pages, webhooks)?

### 2. Trace outbound fetches (SSRF)

```bash
grep -rnE "\\\$fetch\(|fetch\(" --include='*.ts' packages/*/server | grep -v node_modules
grep -rn "validatePublicSiteUrl\|isSafeExternalUrl\|safeFetch" --include='*.ts' packages
```

For every sink: is the URL request-derived? Does it use `safeFetch` (pinned IP,
manual redirects) or a raw `fetch`? Raw `fetch` + `redirect: 'follow'` on a
public route is a P0.

### 3. Trace HTML sinks (XSS)

```bash
grep -rn "v-html\|document.write\|innerHTML" --include='*.vue' --include='*.ts' packages
grep -rn "text/html" --include='*.ts' packages/*/server
```

Any server route returning `text/html` built by string concatenation from
third-party content needs `escapeHtml()` + a `sandbox` CSP. Client `v-html` on
untrusted data must become an `<iframe sandbox="">` or be escaped.

### 4. Check token/secret storage

```bash
grep -rn "accessToken\|refreshToken" packages/db/db packages/db/server/services | head -40
grep -rn "encryptOAuthTokens\|encryptKey\|decryptKey" packages
```

Rules: no plaintext credential column; encryption/decryption at a single
boundary; `decryptKey` fails closed (`null`, never throws).

### 5. Authorisation (IDOR)

```bash
grep -rn "async get\|async find" packages/db/server/services/*.ts | wc -l
```

For each read/write that takes an id from the route: is `userId` in the
predicate, or is membership checked in the handler? Spot-check the newest
services first.

### 6. Uploads and file serving

```bash
grep -rn "readMultipartFormData\|writeFile\|readFile" --include='*.ts' packages/*/server
```

Check: extension allowlist, server-derived MIME, size cap, `basename`,
`resolve()`+prefix, `Content-Disposition`, `Cache-Control: private` for
per-user files.

### 7. Dependencies

```bash
pnpm audit --prod
pnpm audit --prod --json | node -e "…"   # group by module + patched range
```

Patch what has a fix via `overrides` in `pnpm-workspace.yaml`; document what
does not (no patch / breaking major / dev-only).

### 8. Verify

```bash
pnpm install
pnpm audit --prod
pnpm audit:layers
pnpm packages @local-monorepo/site exec nuxt prepare
pnpm site:build
pnpm dlx vite-doctor .
```

Record pre-existing failures explicitly so they are not attributed to the fix.

## Output

Write findings as: **ID · severity (CVSS vector) · file:line · impact ·
reproduction · fix**. Keep a "checked and cleared" table so the next audit does
not re-litigate closed questions. Then write the guide page
(`packages/doc/guide/security-hardening-<date>.md`) and register it in the
VitePress sidebar.
