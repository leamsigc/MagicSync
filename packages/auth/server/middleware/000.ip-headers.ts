/**
 * Strip client-supplied forwarding headers unless a trusted proxy sets them.
 *
 * Without this, `x-real-ip` / `x-forwarded-for` are attacker-controlled and the
 * rate limiter and Better Auth IP tracking can be given a fresh identity per
 * request (fresh bucket = no limit). When the deployment sits behind a proxy
 * that OVERWRITES the header, set `NUXT_TRUST_PROXY=1` and this middleware
 * leaves them alone.
 */
const FORWARDING_HEADERS = [
  'x-real-ip',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'forwarded',
  'cf-connecting-ip',
  'true-client-ip',
]

export default defineEventHandler((event) => {
  if (process.env.NUXT_TRUST_PROXY === '1') return
  for (const header of FORWARDING_HEADERS) {
    delete event.node.req.headers[header]
  }
})
