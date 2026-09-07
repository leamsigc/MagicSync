import { getHeader, getHeaders } from 'h3'
import { defineMcpHandler } from '@nuxtjs/mcp-toolkit/server'
import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { runWithMcpContext } from './utils/mcp-request'
import { verifyOAuthToken } from './utils/mcp-oauth'

/**
 * MCP handler — soft authentication with two credential types.
 *
 * 1. `org_` API keys (Wave 1): verified via ApiKeyService.
 * 2. OAuth access tokens (Wave 2a-B): JWTs minted by our own @better-auth/mcp
 *    authorization server, verified JWKS-locally and resolved to the same
 *    ApiKeyContext shape (business from the stored grant, scope from claims).
 *
 * Branching is structural, not guessed: JWTs contain dots, org_ keys don't.
 * Both paths are soft — failures leave context empty (tools hide via
 * `enabled`) and never throw 401. The OAuth discovery flow is served by the
 * protected-resource metadata route, not by challenges here (see PRD: the
 * 401-trigger is deferred until real-client e2e proves a client needs it).
 */
export default defineMcpHandler({
  middleware: async (event, next) => {
    const authHeader = getHeader(event, 'authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : getHeader(event, 'x-api-key')

    let mcp = undefined
    if (token) {
      if (token.includes('.')) {
        mcp = await verifyOAuthToken(token) ?? undefined
      }
      else {
        const result = await apiKeyService.verifyApiKey(token)
        if (result.success && result.context) {
          mcp = result.context
        }
      }
      if (mcp) {
        event.context.mcp = mcp
      }
    }

    return runWithMcpContext({ mcp, headers: getHeaders(event) }, () => next())
  },
})
