import { getMcpUrls } from '../../../mcp/utils/mcp-urls'

/**
 * RFC 9728 protected-resource metadata for the MagicSync MCP server.
 *
 * NOTE: @nuxtjs/mcp-toolkit registers stub 404 handlers on this exact path
 * (it has no OAuth support). This user-layer route must win — verified by the
 * Wave 2a-B e2e (curl below returns resource_metadata, not the stub error).
 * If the stub ever wins again, remove its handlers via a nitro:config hook.
 *
 * Test: curl http://localhost:3000/.well-known/oauth-protected-resource/mcp
 */
export default defineEventHandler(() => {
  const { resource, issuer } = getMcpUrls()

  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'mcp:read', 'mcp:full'],
    bearer_methods_supported: ['header'],
    resource_name: 'MagicSync MCP',
  }
})
