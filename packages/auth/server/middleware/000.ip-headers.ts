/**
 * Strip client-supplied *IP* forwarding headers unless a trusted proxy sets them.
 *
 * Without this, `x-real-ip` / `x-forwarded-for` are attacker-controlled and the
 * rate limiter and Better Auth IP tracking can be given a fresh identity per
 * request (fresh bucket = no limit). When the deployment sits behind a proxy
 * that OVERWRITES the header, set `NUXT_TRUST_PROXY=1` and this middleware
 * leaves them alone.
 *
 * Only IP headers are removed. `x-forwarded-proto` / `x-forwarded-host` /
 * `forwarded` stay: TLS is terminated at the proxy, so stripping the scheme
 * makes the app believe it is served over http and breaks secure-cookie and
 * origin handling in Better Auth.
 */
const IP_HEADERS = [
  'x-real-ip',
  'x-forwarded-for',
  'cf-connecting-ip',
  'true-client-ip',
]

export default defineEventHandler((event) => {
  if (process.env.NUXT_TRUST_PROXY === '1') return
  for (const header of IP_HEADERS) {
    delete event.node.req.headers[header]
  }
})
