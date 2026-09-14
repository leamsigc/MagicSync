import { defineNuxtConfig } from 'nuxt/config'
import type { NuxtPage } from 'nuxt/schema'
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
    name: 'BaseTools',
  },
  extends: ['@local-monorepo/ui', '@local-monorepo/db', '@local-monorepo/auth', '@local-monorepo/assets'],
  modules: ['@nuxtjs/i18n', '@nuxt/fonts', 'evlog/nuxt'],
  fonts: {
    // Every declared family below lives on Google Fonts. Pin providers so
    // builds never depend on bunny/fontshare uptime: @nuxt/fonts falls through
    // to the next provider when a family lacks a weight/subset, and Bunny CDN
    // fetches time out inside Docker builds (EAI/ETIMEDOUT on bunnyinfra.net),
    // which previously failed `pnpm site` outright.
    providers: {
      bunny: false,
      fontshare: false,
      fontsource: false,
      adobe: false,
    },
    // Carousel + OG-image typefaces. `global: true` is required: the creator
    // applies fonts via inline styles in JS-generated HTML, which the module
    // cannot auto-detect in CSS. Browsers only download weights actually
    // rendered, so declaring wide coverage stays cheap at runtime.
    defaults: {
      weights: [400, 700, 900],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
    },
    families: [
      { name: 'Roboto', global: true },
      { name: 'Open Sans', global: true },
      { name: 'Lato', global: true },
      { name: 'Montserrat', global: true },
      { name: 'Oswald', global: true },
      { name: 'Source Sans 3', global: true },
      { name: 'Slabo 27px', global: true },
      { name: 'Raleway', global: true },
      { name: 'PT Sans', global: true },
      { name: 'Merriweather', global: true },
      { name: 'Noto Sans', global: true },
      { name: 'Noto Serif', global: true },
      { name: 'Nunito Sans', global: true },
      { name: 'Concert One', global: true },
      { name: 'Prompt', global: true },
      { name: 'Work Sans', global: true },
      { name: 'Inter', global: true },
      { name: 'Instrument Sans', global: true },
      { name: 'Instrument Serif', global: true },
      { name: 'Epilogue', global: true },
      { name: 'Syne', global: true },
      { name: 'DM Sans', global: true },
      { name: 'DM Mono', global: true },
      { name: 'Questrial', global: true },
      { name: 'Alegreya', global: true },
      { name: 'Alegreya Sans', global: true },
      { name: 'News Cycle', global: true },
      { name: 'Plus Jakarta Sans', global: true },
      { name: 'Mona Sans', global: true },
      { name: 'Hubot Sans', global: true },
      { name: 'Urbanist', global: true },
      { name: 'Mulish', global: true },
      { name: 'Outfit', global: true },
      { name: 'League Spartan', global: true },
      { name: 'Tenor Sans', global: true },
      { name: 'Andika', global: true },
      { name: 'Asul', global: true },
      { name: 'Salsa', global: true },
      { name: 'Red Rose', global: true },
      { name: 'Bricolage Grotesque', global: true },
      { name: 'Young Serif', global: true },
      { name: 'Fraunces', global: true },
      { name: 'Newsreader', global: true },
      { name: 'Lora', global: true },
      { name: 'EB Garamond', global: true },
      { name: 'Averia Serif Libre', global: true },
      { name: 'Besley', global: true },
      { name: 'IBM Plex Serif', global: true },
      { name: 'IBM Plex Mono', global: true },
      { name: 'Libre Baskerville', global: true },
      { name: 'Nanum Myeongjo', global: true },
      { name: 'Trocchi', global: true },
      { name: 'Old Standard TT', global: true },
      { name: 'Space Mono', global: true },
      { name: 'JetBrains Mono', global: true },
      { name: 'Silkscreen', global: true },
      { name: 'La Belle Aurore', global: true },
      { name: 'Felipa', global: true },
      { name: 'Great Vibes', global: true },
      { name: 'Pinyon Script', global: true },
      { name: 'Alex Brush', global: true },
      { name: 'Oregano', global: true },
      { name: 'Birthstone', global: true },
      { name: 'Birthstone Bounce', global: true },
      { name: 'Borel', global: true },
      { name: 'Smooch', global: true },
      { name: 'Spicy Rice', global: true },
      { name: 'Slackey', global: true },
      { name: 'Fontdiner Swanky', global: true },
      { name: 'Moo Lah Lah', global: true },
      { name: 'Mouse Memoirs', global: true },
      { name: 'Marmelad', global: true },
      { name: 'Aboreto', global: true },
    ],
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
  evlog: {
    env: {
      service: 'layer-tools',
    },
    // Optional: only log specific routes (supports glob patterns)
    include: ['/api/**'],
    // Optional: exclude specific routes from logging
    exclude: ['/api/_nuxt_icon/**'],
  },
})
