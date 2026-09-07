import { AsyncLocalStorage } from 'node:async_hooks'
import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'

interface McpRequestStore {
  mcp: ApiKeyContext | undefined
  /** Snapshot of request headers (for helpers needing auth headers, e.g. token refresh). */
  headers: Record<string, string | string[] | undefined>
}

const storage = new AsyncLocalStorage<McpRequestStore>()

/**
 * Run the MCP request chain with per-request auth context.
 * The toolkit (0.19.0) does not pass the H3 event into tool handlers and the
 * bundled h3 (v1) has no useEvent() — so the handler middleware wraps next()
 * in our own AsyncLocalStorage. Tools read it via getMcpContext().
 */
export function runWithMcpContext<T>(store: McpRequestStore, fn: () => T): T {
  return storage.run(store, fn)
}

function getStore(): McpRequestStore | undefined {
  return storage.getStore()
}

export function getMcpContext(): ApiKeyContext | undefined {
  return getStore()?.mcp
}

export function getMcpHeaders(): Record<string, string | string[] | undefined> {
  return getStore()?.headers ?? {}
}
