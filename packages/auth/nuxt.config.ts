import { defineNuxtConfig } from 'nuxt/config'
import type { NuxtPage } from 'nuxt/schema'
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
    }
  },
  $meta: {
    name: 'BaseAuth',
  },
  runtimeConfig: {
    // Auth specific
    BETTER_AUTH_URL: process.env.NUXT_BETTER_AUTH_URL,
    // Google
    GOOGLE_CLIENT_ID: process.env.NUXT_GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.NUXT_GOOGLE_CLIENT_SECRET,
    // Facebook
    FACEBOOK_CLIENT_ID: process.env.NUXT_FACEBOOK_CLIENT_ID,
    FACEBOOK_CLIENT_SECRET: process.env.NUXT_FACEBOOK_CLIENT_SECRET,
    FACEBOOK_CONFIG_ID: process.env.NUXT_FACEBOOK_CONFIG_ID,
    // Tiktok
    TIKTOK_CLIENT_ID: process.env.NUXT_TIKTOK_CLIENT_ID,
    TIKTOK_CLIENT_SECRET: process.env.NUXT_TIKTOK_CLIENT_SECRET,
    // Twitter
    TWITTER_CLIENT_ID: process.env.NUXT_TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET: process.env.NUXT_TWITTER_CLIENT_SECRET,
    // LinkedIn
    LINKEDIN_CLIENT_ID: process.env.NUXT_LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET: process.env.NUXT_LINKEDIN_CLIENT_SECRET,
    // GitHub
    GITHUB_CLIENT_ID: process.env.NUXT_GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.NUXT_GITHUB_CLIENT_SECRET,
    // App URL
    APP_URL: process.env.NUXT_APP_URL,
    // Discord
    DISCORD_CLIENT_ID: process.env.NUXT_DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.NUXT_DISCORD_CLIENT_SECRET,
    // Reddit
    REDDIT_CLIENT_ID: process.env.NUXT_REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.NUXT_REDDIT_CLIENT_SECRET,
    // Dribbble
    DRIBBBLE_CLIENT_ID: process.env.NUXT_DRIBBBLE_CLIENT_ID,
    DRIBBBLE_CLIENT_SECRET: process.env.NUXT_DRIBBBLE_CLIENT_SECRET,
    // YouTube
    YOUTUBE_CLIENT_ID: process.env.NUXT_YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.NUXT_YOUTUBE_CLIENT_SECRET,
    // Threads
    THREADS_CLIENT_ID: process.env.NUXT_THREADS_CLIENT_ID,
    THREADS_CLIENT_SECRET: process.env.NUXT_THREADS_CLIENT_SECRET,
    // Instagram
    INSTAGRAM_CLIENT_ID: process.env.NUXT_INSTAGRAM_CLIENT_ID,
    INSTAGRAM_CLIENT_SECRET: process.env.NUXT_INSTAGRAM_CLIENT_SECRET,
    // Wordpress
    WORDPRESS_CLIENT_ID: process.env.NUXT_WORDPRESS_CLIENT_ID,
    WORDPRESS_CLIENT_SECRET: process.env.NUXT_WORDPRESS_CLIENT_SECRET,
  },
  extends: ['@local-monorepo/db', '@local-monorepo/ui', '@local-monorepo/email',],
  modules: ['@nuxtjs/i18n', 'nuxt-auth-utils', 'evlog/nuxt'],
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
      service: 'layer-auth',
    },
    // Optional: only log specific routes (supports glob patterns)
    include: ['/api/**'],
    // Optional: exclude specific routes from logging
    exclude: ['/api/_nuxt_icon/**'],
  },
})
