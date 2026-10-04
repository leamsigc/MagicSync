import { defineNuxtConfig } from 'nuxt/config'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const currentDir = dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  // debug: true,
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
  runtimeConfig: {
    BASE_URL: process.env.NUXT_BASE_URL,
  },
  $meta: {
    name: 'BaseConnect',
  },
  // `agent` is a foundation layer (§5.1 of PRD-LAYER-RESTRUCTURE), and
  // `server/api/v1/business/[id]/playbook/refine.post.ts` calls
  // `runCapability('playbook.refine')`. Without it in `extends` the
  // `#layers/BaseAgent` specifiers resolve only under the site composition
  // root, and every connect route 500s in this playground. `ai-tools` extends
  // `agent` for the same reason.
  extends: ['@local-monorepo/db', '@local-monorepo/ui', '@local-monorepo/auth', '@local-monorepo/agent'],
  modules: ['@nuxtjs/i18n', 'evlog/nuxt', '@comark/nuxt'],
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
      service: 'layer-connect',
    },
    // Optional: only log specific routes (supports glob patterns)
    include: ['/api/**'],
    // Optional: exclude specific routes from logging
    exclude: ['/api/_nuxt_icon/**'],
  },
})
