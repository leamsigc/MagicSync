import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'

declare module 'h3' {
  interface H3EventContext {
    /** MagicSync API-key context set by server/mcp/index.ts middleware. Absent for anonymous callers. */
    mcp?: ApiKeyContext
  }
}

export {}
