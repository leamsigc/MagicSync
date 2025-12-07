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
    NUXT_BETTER_AUTH_URL: process.env.NUXT_BETTER_AUTH_URL,
    // Google
    NUXT_GOOGLE_CLIENT_ID: process.env.NUXT_GOOGLE_CLIENT_ID,
    NUXT_GOOGLE_CLIENT_SECRET: process.env.NUXT_GOOGLE_CLIENT_SECRET,
    // Facebook
    NUXT_FACEBOOK_CLIENT_ID: process.env.NUXT_FACEBOOK_CLIENT_ID,
    NUXT_FACEBOOK_CLIENT_SECRET: process.env.NUXT_FACEBOOK_CLIENT_SECRET,
    NUXT_FACEBOOK_CONFIG_ID: process.env.NUXT_FACEBOOK_CONFIG_ID,
    // Tiktok
    NUXT_TIKTOK_CLIENT_ID: process.env.NUXT_TIKTOK_CLIENT_ID,
    NUXT_TIKTOK_CLIENT_SECRET: process.env.NUXT_TIKTOK_CLIENT_SECRET,
    // Twitter
    NUXT_TWITTER_CLIENT_ID: process.env.NUXT_TWITTER_CLIENT_ID,
    NUXT_TWITTER_CLIENT_SECRET: process.env.NUXT_TWITTER_CLIENT_SECRET,
    // LinkedIn
    NUXT_LINKEDIN_CLIENT_ID: process.env.NUXT_LINKEDIN_CLIENT_ID,
    NUXT_LINKEDIN_CLIENT_SECRET: process.env.NUXT_LINKEDIN_CLIENT_SECRET,
    // GitHub
    NUXT_GITHUB_CLIENT_ID: process.env.NUXT_GITHUB_CLIENT_ID,
    NUXT_GITHUB_CLIENT_SECRET: process.env.NUXT_GITHUB_CLIENT_SECRET,
    // App URL
    NUXT_APP_URL: process.env.NUXT_APP_URL,
    // Discord
    NUXT_DISCORD_CLIENT_ID: process.env.NUXT_DISCORD_CLIENT_ID,
    NUXT_DISCORD_CLIENT_SECRET: process.env.NUXT_DISCORD_CLIENT_SECRET,
    // Reddit
    NUXT_REDDIT_CLIENT_ID: process.env.NUXT_REDDIT_CLIENT_ID,
    NUXT_REDDIT_CLIENT_SECRET: process.env.NUXT_REDDIT_CLIENT_SECRET,
    // Dribbble
    NUXT_DRIBBBLE_CLIENT_ID: process.env.NUXT_DRIBBBLE_CLIENT_ID,
    NUXT_DRIBBBLE_CLIENT_SECRET: process.env.NUXT_DRIBBBLE_CLIENT_SECRET,
    // YouTube
    NUXT_YOUTUBE_CLIENT_ID: process.env.NUXT_YOUTUBE_CLIENT_ID,
    NUXT_YOUTUBE_CLIENT_SECRET: process.env.NUXT_YOUTUBE_CLIENT_SECRET,
    // Threads
    NUXT_THREADS_CLIENT_ID: process.env.NUXT_THREADS_CLIENT_ID,
    NUXT_THREADS_CLIENT_SECRET: process.env.NUXT_THREADS_CLIENT_SECRET,
    // Instagram
    NUXT_INSTAGRAM_CLIENT_ID: process.env.NUXT_INSTAGRAM_CLIENT_ID,
    NUXT_INSTAGRAM_CLIENT_SECRET: process.env.NUXT_INSTAGRAM_CLIENT_SECRET,
    // Wordpress
    NUXT_WORDPRESS_CLIENT_ID: process.env.NUXT_WORDPRESS_CLIENT_ID,
    NUXT_WORDPRESS_CLIENT_SECRET: process.env.NUXT_WORDPRESS_CLIENT_SECRET,
  },
  extends: ['@local-monorepo/db', '@local-monorepo/ui', '@local-monorepo/email'],
  modules: ['@nuxtjs/i18n', 'nuxt-auth-utils',],
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
