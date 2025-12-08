import { defineNuxtConfig } from 'nuxt/config'
import type { NuxtPage } from 'nuxt/schema'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const currentDir = dirname(fileURLToPath(import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  routeRules: {
    "/": { swr: 1200 },
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
    // Database
    NUXT_TURSO_DATABASE_URL: process.env.NUXT_TURSO_DATABASE_URL,
    NUXT_TURSO_AUTH_TOKEN: process.env.NUXT_TURSO_AUTH_TOKEN,
    // Session
    NUXT_SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD,
    // Better Auth
    NUXT_BETTER_AUTH_SECRET: process.env.NUXT_BETTER_AUTH_SECRET,
    NUXT_BETTER_AUTH_URL: process.env.NUXT_BETTER_AUTH_URL,
    // Mailgun
    NUXT_MAILGUN_API_KEY: process.env.NUXT_MAILGUN_API_KEY,
    NUXT_MAILGUN_DOMAIN: process.env.NUXT_MAILGUN_DOMAIN,
    NUXT_MAIL_FROM_EMAIL: process.env.NUXT_MAIL_FROM_EMAIL,
    // File Storage
    NUXT_FILE_STORAGE_MOUNT: process.env.NUXT_FILE_STORAGE_MOUNT,
    // OpenAI
    NUXT_OPENAI_API_KEY: process.env.NUXT_OPENAI_API_KEY,
    // Pexels
    NUXT_PEXELS_API_KEY: process.env.NUXT_PEXELS_API_KEY,
    // Google Generative AI
    googleGenerativeAiApiKey: process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY,
    // Social media 
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

  extends: [
    '@local-monorepo/ui',
    '@local-monorepo/db',
    '@local-monorepo/auth',
    '@local-monorepo/email',
    '@local-monorepo/assets',
    '@local-monorepo/content',
    '@local-monorepo/tools',
    '@local-monorepo/scheduler',
    '@local-monorepo/connect',
    '@local-monorepo/templates'
  ],

  modules: ['@nuxtjs/seo', '@nuxtjs/i18n', '@nuxt/hints', 'nuxt-umami'],
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
  site: {
    url: "https://magicsync.dev",
    name: "MagicSync - Social Media Management Made Easy"
  },
  umami: {
    id: '55b75e65-727f-44ae-9f58-c2d67c2f3b4b',
    host: 'https://umami.giessen.dev',
    autoTrack: true,
    ignoreLocalhost: true
  },
})