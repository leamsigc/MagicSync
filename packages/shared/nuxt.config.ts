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
  devtools: { enabled: process.env.NODE_ENV !== 'production' && !process.env.CI },
  modules: ['@pinia/nuxt', 'evlog/nuxt'],
})
