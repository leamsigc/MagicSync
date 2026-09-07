/**
 * Canonical MCP + OAuth URLs, derived identically everywhere (protected-resource
 * route, OAuth verifier, consent links). resource is per-deployment from env.
 */
export function getMcpUrls(): { resource: string, issuer: string, jwksUrl: string } {
  const config = useRuntimeConfig()
  const appUrl = String(config.APP_URL || process.env.NUXT_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return {
    resource: `${appUrl}/mcp`,
    issuer: `${appUrl}/api/auth`,
    jwksUrl: `${appUrl}/api/auth/jwks`,
  }
}
