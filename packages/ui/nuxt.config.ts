import { defineNuxtConfig } from 'nuxt/config'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { NuxtPage } from 'nuxt/schema'

const currentDir = dirname(fileURLToPath(import.meta.url))

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
    }
  },
  $meta: {
    name: 'BaseUI',
  },
  modules: [
    "@nuxt/eslint",
    "@nuxt/image",
    "@nuxt/ui",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    '@nuxtjs/i18n',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt'
  ],
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
  /*
    Nuxt UI RELATED CONFIGS
   */
  css: [
    join(currentDir, './app/assets/css/main.css'),
    join(currentDir, './app/assets/css/full-calendar.css'),
  ],
  ui: {
    fonts: true,
    colorMode: true,
    content: true,
    mdc: true
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
