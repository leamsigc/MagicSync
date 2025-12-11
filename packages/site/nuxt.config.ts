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
    "/app/**": { swr: false },
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
    APP_URL: process.env.NUXT_APP_URL,
    BASE_URL: process.env.NUXT_APP_URL,
    // Database
    TURSO_DATABASE_URL: process.env.NUXT_TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.NUXT_TURSO_AUTH_TOKEN,
    // Session
    SESSION_PASSWORD: process.env.NUXT_SESSION_PASSWORD,
    // Better Auth
    BETTER_AUTH_SECRET: process.env.NUXT_BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.NUXT_BETTER_AUTH_URL,
    // Mailgun
    MAILGUN_API_KEY: process.env.NUXT_MAILGUN_API_KEY,
    MAILGUN_DOMAIN: process.env.NUXT_MAILGUN_DOMAIN,
    MAIL_FROM_EMAIL: process.env.NUXT_MAIL_FROM_EMAIL,
    // File Storage
    FILE_STORAGE_MOUNT: process.env.NUXT_FILE_STORAGE_MOUNT,
    // OpenAI
    OPENAI_API_KEY: process.env.NUXT_OPENAI_API_KEY,
    // Pexels
    PEXELS_API_KEY: process.env.NUXT_PEXELS_API_KEY,
    // Google Generative AI
    googleGenerativeAiApiKey: process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY,
    // Social media 
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