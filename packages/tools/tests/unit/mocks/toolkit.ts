// Stand-in for @nuxtjs/mcp-toolkit/server (Nuxt-only). Identity wrapper so
// tests exercise the real inputSchema + handler the toolkit would register.
export function defineMcpTool<T>(def: T): T {
  return def
}
