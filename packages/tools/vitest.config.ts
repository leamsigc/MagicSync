import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const toolsRoot = fileURLToPath(new URL('./', import.meta.url))
const mocks = fileURLToPath(new URL('./tests/unit/mocks', import.meta.url))

/**
 * Unit tests for server/shared TypeScript (no .vue, no browser).
 * Node environment: fabric/node + node-canvas load for real here.
 * Mirrors the #layers/* aliases the Nuxt layers provide at runtime.
 * Nuxt-only modules (MCP toolkit, MCP auth context/audit, DB services) are
 * redirected to deterministic stand-ins under tests/unit/mocks.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 120000,
    setupFiles: ['./tests/unit/setup.ts'],
  },
  resolve: {
    // NOTE: specific file redirects must precede the generic #layers roots —
    // Vite applies the first matching alias.
    alias: {
      '@nuxtjs/mcp-toolkit/server': `${mocks}/toolkit.ts`,
      '#layers/BaseDB/server/services/carousel.service': `${mocks}/services.ts`,
      '#layers/BaseDB/server/services/menu-board.service': `${mocks}/services.ts`,
      '#layers/BaseDB/server/services/post.service': `${mocks}/services.ts`,
      '#layers/BaseShared/server/services/asset.service': `${mocks}/services.ts`,
      '#layers/BaseTools': toolsRoot,
      '#layers/BaseDB': fileURLToPath(new URL('../db', import.meta.url)),
      '#layers/BaseShared': fileURLToPath(new URL('../shared', import.meta.url)),
      '#layers/BaseAuth': fileURLToPath(new URL('../auth', import.meta.url)),
    },
  },
})
