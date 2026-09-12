import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  extends: ['@local-monorepo/shared'],
  experimental: {
    viteEnvironmentApi: true,
    typescriptPlugin: true
  },
  future: {
    compatibilityVersion: 5
  },
  $meta: {
    name: 'BaseAgent',
  },
  devtools: { enabled: true },
})
