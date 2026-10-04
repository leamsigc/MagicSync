import { defineNuxtConfig } from 'nuxt/config'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const currentDir = dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  devtools: { enabled: true },
  experimental: {
    viteEnvironmentApi: true,
    typescriptPlugin: true
  },
  future: {
    compatibilityVersion: 5
  },
  nitro: {
    experimental: {
      openAPI: true,
      tasks: true,
    },
    scheduledTasks: {
      // Run `social:post` + adaptive stats collection every 15 minutes
      '*/15 * * * *': ['social:post', 'stats:collect', 'repost:process', 'autoreply:process'],
      // Run `token:health` every 6 hours to log expiring/expired tokens
      '0 */6 * * *': ['token:health'],
      // Daily notification digest email (07:00 UTC)
      '0 7 * * *': ['notifications:digest'],
      // Safe-mode morning workspace report (08:00 UTC)
      '0 8 * * *': ['agent:morning-heartbeat'],
    }
  },
  $meta: {
    name: 'BaseScheduler',
  },
  runtimeConfig: {
    APP_URL: process.env.NUXT_APP_URL,
    googleGenerativeAiApiKey: process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY,
  },
  extends: ['@local-monorepo/db', '@local-monorepo/ui', '@local-monorepo/auth'],
  modules: ['@nuxtjs/i18n', 'evlog/nuxt'],
  i18n: {
    vueI18n: join(currentDir, './translations/i18n.config.ts'),
    baseUrl: process.env.NUXT_APP_URL,
    locales: [
      { code: 'en', language: 'en-US', name: 'English' },
      { code: 'es', language: 'es-ES', name: 'Español' },
      { code: 'de', language: 'de-DE', name: 'Deutsch' },
      { code: 'fr', language: 'fr-FR', name: 'Français' }
    ],
    defaultLocale: 'en',
    // bundle: ''
  },
  evlog: {
    env: {
      service: 'layer-scheduler',
    },
    // Optional: only log specific routes (supports glob patterns)
    include: ['/api/**'],
    // Optional: exclude specific routes from logging
    exclude: ['/api/_nuxt_icon/**'],
  },
})
