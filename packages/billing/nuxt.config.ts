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
    }
  },
  $meta: {
    name: 'BaseBilling',
  },
  runtimeConfig: {
    public: {
      /**
       * Whether the trial/paid check actually blocks. Off by default: turning it
       * on for the first time must be a deliberate, deploy-level decision, not a
       * side effect of adding the billing page.
       */
      billingEnforce: process.env.BILLING_ENFORCE_ACCESS === 'true',
    },
  },
  extends: ['@local-monorepo/db', '@local-monorepo/ui', '@local-monorepo/auth',],
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
  },
  evlog: {
    env: {
      service: 'layer-billing',
    },
    include: ['/api/**'],
    exclude: ['/api/_nuxt_icon/**'],
  },
})
