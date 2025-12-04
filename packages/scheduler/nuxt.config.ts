import { defineNuxtConfig } from 'nuxt/config'
import { type NuxtPage } from 'nuxt/schema'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const currentDir = dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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
    // scheduledTasks: {
    //   // Run `cms:update` task every minute
    //   '* * * * *': ['social:post']
    // }
  },
  $meta: {
    name: 'BaseScheduler',
  },
  runtimeConfig: {
    NUXT_APP_URL: process.env.NUXT_APP_URL,
    googleGenerativeAiApiKey: process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY
  },
  extends: ['@local-monorepo/db', '@local-monorepo/ui', '@local-monorepo/auth', "@local-monorepo/connect", "@local-monorepo/assets"],
  modules: ['@nuxtjs/i18n'],
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
