# SSRF-safe outbound fetch

**When to use:** any server-side request whose URL comes from a request body,
query string, or third-party content (webhook payload, review, post, LLM tool
argument). Also when reviewing an existing `$fetch`/`fetch` on a public route.

## The failure mode this exists for

Validating a URL and then letting `fetch` follow redirects is **not** SSRF
protection:

```ts
// Broken
const { safe } = await isSafeExternalUrl(url)   // checks hop 1
if (!safe) throw createError({ statusCode: 400 })
await fetch(url, { redirect: 'follow' })         // hop 2 → 169.254.169.254
```

DNS rebinding is the second hole: `lookup()` at validation and `connect()` at
request time are two resolutions, and the attacker controls both answers.

## Steps

1. **Import the shared guard**, never roll a local one:
   ```ts
   import { safeFetch, safeFetchStream } from '#layers/BaseShared/server/utils/ssrf'
   ```
2. **Pick the right call**:
   - `safeFetch(url, { maxBytes, timeoutMs, headers })` → `{ status, headers, body: Buffer, finalUrl }`
   - `safeFetchStream(url, …)` → `{ status, headers, stream, finalUrl, cleanup }` + `capStream(stream, max)`
3. **Never use `$fetch`/`fetch` directly on a request-derived URL.** If you
   must (a provider SDK that takes a base URL), validate with
   `validateOutboundUrl` / `validatePublicSiteUrl` on **write** and on
   **read**, and pin the host.
4. **Cap the response.** `maxBytes` for buffered, `capStream` for streaming.
   Unbounded `arrayBuffer()` is a memory-exhaustion DoS.
5. **Restrict content types** when proxying to a browser (audio, images) and
   drop `Access-Control-Allow-Origin: *`.
6. **Test the redirect.** A local fixture that 302s to
   `http://169.254.169.254/` must return 400, and a public URL that serves a
   10 MB body must be truncated/rejected.

## Gotchas

- `new URL('http://[::1]/').hostname` keeps the brackets — strip them **before**
  `isIP()`, otherwise the literal is not classified as an IP at all.
- **IPv4-mapped IPv6 is the classic bypass.** `::ffff:127.0.0.1` (dotted) is
  easy to spot; `::ffff:7f00:1` (the canonical hex form) is what a resolver
  actually returns for an `AAAA ::ffff:7f00:1` record. Expand IPv6 to hextets
  and decode `::ffff:0:0/96`, `::ffff:0:0:0/96`, `64:ff9b::/96` (NAT64) and
  `2002::/16` (6to4) back to IPv4 before deciding.
- `isIP('2130706433') === 0`, but `getaddrinfo` resolves it to `127.0.0.1`;
  the DNS-resolved check catches it, so do not skip resolution.
- Keep **one** implementation of `isBlockedIp`. Two copies is how the mapped
  IPv6 bypass shipped twice; `url-allowlist.ts` now imports the shared guard.
- `setTimeout` on a socket is an **idle** timeout. A server that drips one byte
  at a time keeps it alive — add an `AbortController` deadline for the whole
  request body.
- Local model runners (Ollama / llama.cpp) legitimately need private hosts.
  Allowlist them explicitly (`NUXT_LOCAL_LLM_HOSTS`) instead of disabling the
  guard for "local" generally.
- The Python sidecar needs the same treatment; it is a second proxy.
- When revoking trust in forwarding headers, **strip them** for untrusted
  deployments. Reading `x-real-ip` "only if present" is the same as trusting it.

