import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { defineNuxtConfig } from 'nuxt/config'

// Nitro bundles server code with Rollup, which has no Vite-style `?raw`.
// This plugin resolves `./file.md?raw` imports and inlines the file contents,
// so prompts/skills stay authored as Markdown with zero runtime filesystem
// dependency (node tests cover the same imports via tests/resolve-hook.mjs).
function rawTextPlugin() {
  return {
    name: 'agent-raw-text',
    resolveId(source: string, importer?: string) {
      if (!source.endsWith('?raw')) return null
      const target = source.slice(0, -4)
      const absolute = isAbsolute(target) ? target : resolve(dirname(importer ?? ''), target)
      return `${absolute}?raw`
    },
    load(id: string) {
      if (!id.endsWith('?raw')) return null
      const contents = readFileSync(id.slice(0, -4), 'utf8')
      return `export default ${JSON.stringify(contents)}`
    },
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  extends: ['@local-monorepo/db', '@local-monorepo/auth'],
  experimental: {
    viteEnvironmentApi: true,
    typescriptPlugin: true
  },
  future: {
    compatibilityVersion: 5
  },
  nitro: {
    rollupConfig: {
      plugins: [rawTextPlugin()],
    },
  },
  $meta: {
    name: 'BaseAgent',
  },
  devtools: { enabled: true },
})
