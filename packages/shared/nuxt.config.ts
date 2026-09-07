import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  experimental: {
    viteEnvironmentApi: true,
    typescriptPlugin: true
  },
  future: {
    compatibilityVersion: 5
  },
  $meta: {
    name: 'BaseShared',
  },
  devtools: { enabled: true },
})
