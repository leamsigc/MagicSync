import { defineNuxtConfig } from 'nuxt/config'
import type { NuxtPage } from 'nuxt/schema'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const currentDir = dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  routeRules: {
    "/": { static: true },
    "/blog": { swr: true },
    "/blog/**": { swr: 1200 },
    "/app/**": { swr: true },
    '/api/v1/**': {
      cors: true
    }
  },
  // debug: true,
  experimental: {
    viteEnvironmentApi: true,
    typescriptPlugin: true
  },
  future: {
    compatibilityVersion: 5
  },
  devtools: { enabled: true },

  nitro: {
    experimental: {
      openAPI: true,
      tasks: true,
    },
  },
  runtimeConfig: {
    NUXT_APP_URL: process.env.NUXT_APP_URL,
    NUXT_TURSO_DATABASE_URL: process.env.NUXT_TURSO_DATABASE_URL,
    NUXT_TURSO_AUTH_TOKEN: process.env.NUXT_TURSO_AUTH_TOKEN,
    NUXT_SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD,
    NUXT_BETTER_AUTH_SECRET: process.env.NUXT_BETTER_AUTH_SECRET,
    NUXT_BETTER_AUTH_URL: process.env.NUXT_BETTER_AUTH_URL,
    NUXT_MAILGUN_API_KEY: process.env.NUXT_MAILGUN_API_KEY,
    NUXT_MAILGUN_DOMAIN: process.env.NUXT_MAILGUN_DOMAIN,
    NUXT_MAIL_FROM_EMAIL: process.env.NUXT_MAIL_FROM_EMAIL,
    NUXT_GOOGLE_CLIENT_ID: process.env.NUXT_GOOGLE_CLIENT_ID,
    NUXT_GOOGLE_CLIENT_SECRET: process.env.NUXT_GOOGLE_CLIENT_SECRET,
    NUXT_OPENAI_API_KEY: process.env.NUXT_OPENAI_API_KEY,
    NUXT_FACEBOOK_CLIENT_ID: process.env.NUXT_FACEBOOK_CLIENT_ID,
    NUXT_FACEBOOK_CLIENT_SECRET: process.env.NUXT_FACEBOOK_CLIENT_SECRET,
    NUXT_FACEBOOK_CONFIG_ID: process.env.NUXT_FACEBOOK_CONFIG_ID,
    NUXT_FILE_STORAGE_MOUNT: process.env.NUXT_FILE_STORAGE_MOUNT,
    NUXT_PEXELS_API_KEY: process.env.NUXT_PEXELS_API_KEY,
  },

  extends: [
    '@local-monorepo/ui',
    '@local-monorepo/db',
    '@local-monorepo/auth',
    '@local-monorepo/email',
    '@local-monorepo/assets',
    '@local-monorepo/content',
    '@local-monorepo/tools',
    '@local-monorepo/scheduler',
    '@local-monorepo/connect'
  ],

  modules: ['@nuxtjs/seo', '@nuxtjs/i18n', '@nuxt/hints'],
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
    strategy: 'prefix_except_default',
    // bundle: ''
  },
  hooks: {
    'pages:extend': function (pages) {
      const pagesToRemove: NuxtPage[] = []
      pages.forEach((page) => {
        const pathsToExclude = ['types', 'components', '/api', 'composables', 'utils', '.json']
        if (pathsToExclude.some(excludePath => page.path.includes(excludePath))) {
          pagesToRemove.push(page)
        }
      })
      pagesToRemove.forEach((page: NuxtPage) => {
        pages.splice(pages.indexOf(page), 1)
      })
      /* Uncomment to show current Routes
      console.log(`\nCurrent Routes:`)
      console.log(pages)
      console.log(`\n`) */
    }
  },
})