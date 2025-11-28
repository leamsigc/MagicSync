import { defineNuxtConfig } from 'nuxt/config'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { NuxtPage } from 'nuxt/schema'

const currentDir = dirname(fileURLToPath(import.meta.url))

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
    name: 'BaseContent',
  },
  extends: ['@local-monorepo/ui'],
  modules: ['@nuxtjs/i18n', "@nuxtjs/seo", '@nuxt/content'],
  content: {
    build: {
      markdown: {
        highlight: {
          theme: {
            // Default theme (same as single string)
            default: 'github-light',
            // Theme used if `html.dark`
            dark: 'monokai',
            // Theme used if `html.sepia`
            sepia: 'monokai'
          }
        }
      }
    }
  },
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
