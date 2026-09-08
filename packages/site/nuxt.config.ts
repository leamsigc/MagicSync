import { defineNuxtConfig } from 'nuxt/config'
import type { NuxtPage } from 'nuxt/schema'
import { readdirSync, statSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const currentDir = dirname(fileURLToPath(import.meta.url))

// Blog posts live at /blogs/<slug> but were historically also reachable (as
// soft-404s) at root level because the sitemap emitted unprefixed paths.
// Generate 301s from the content directory so any crawled root-level URL
// passes its signals to the canonical /blogs/<slug> version.
function collectBlogSlugs(dir: string, base = ''): string[] {
  const slugs: string[] = []
  if (!existsSync(dir)) return slugs
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    if (existsSync(join(full, 'index.md'))) {
      slugs.push(base ? `${base}/${entry}` : entry)
    }
    else {
      slugs.push(...collectBlogSlugs(full, base ? `${base}/${entry}` : entry))
    }
  }
  return slugs
}

const blogSlugs = collectBlogSlugs(join(currentDir, '../content/content/en/blogs'))
const blogRootRedirects = Object.fromEntries(
  blogSlugs.map(slug => [`/${slug}`, { redirect: { to: `/blogs/${slug}`, statusCode: 301 } }])
)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  routeRules: {
    "/": { swr: 1200 },
    "/blog": { swr: true },
    "/blog/**": { swr: 1200 },
    "/app/**": { swr: false },
    '/api/v1/**': {
      cors: true
    },
    // Cross-origin isolation for on-device WASM tools (TTS, etc.)
    // — copied here so Vite dev-server middleware also picks them up.
    '/app/tools/**': {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
    // `/home` is an exact duplicate of `/` — consolidate all signals on `/`.
    '/home': { redirect: { to: '/', statusCode: 301 } },
    ...blogRootRedirects,
    // Dev/internal routes: emit `X-Robots-Tag: noindex` so Google drops them.
    // NOTE: intentionally NOT blocked in robots.txt — a crawl block would
    // prevent Google from re-crawling and seeing the noindex. They are also
    // removed from the sitemap (see sitemap.exclude below).
    '/ui-preview/**': { robots: false },
    '/es/ui-preview/**': { robots: false },
    '/de/ui-preview/**': { robots: false },
    '/fr/ui-preview/**': { robots: false },
    '/twitter-mock': { robots: false },
    '/es/twitter-mock': { robots: false },
    '/de/twitter-mock': { robots: false },
    '/fr/twitter-mock': { robots: false },
    '/_scripts': { robots: false },
  },
  // debug: true,
  experimental: {
    viteEnvironmentApi: true,
    typescriptPlugin: true,
    nitroAutoImports: true
  },
  future: {
    compatibilityVersion: 5
  },
  devtools: { enabled: process.env.NODE_ENV !== 'production' && !process.env.CI },
  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: ''
  },

  nitro: {
    serverOptions: {
      timeout: 300000,
    },
    // papaparse must stay external: bundling it into the Nitro server output
    // lets an SSR transform rewrite `typeof window` inside its worker-blob
    // template string, producing unparseable JS that kills prerender with
    // `RollupError: Expected ',', got 'undefined'`. Kept as a runtime
    // require instead (used by bulk-scheduler csv-import.post.ts).
    externals: {
      external: ['papaparse'],
    },
    experimental: {
      openAPI: true,
      tasks: true,
      // REQUIRED for useEvent() inside MCP tool handlers (@nuxtjs/mcp-toolkit)
      asyncContext: true,
    },
  },
  // Cross-origin isolation scoped to the on-device WASM-using tools.
  //  Why COOP/COEP: ONNX Runtime Web's JSEP execution provider needs
  //  SharedArrayBuffer, which browsers only expose to pages that are
  //  `crossOriginIsolated` (i.e. send these headers).
  //  Why `credentialless` (not `require-corp`): the app loads cross-origin
  //  resources (Google Fonts, Pexels images, Umami analytics) without
  //  explicit CORP headers. `require-corp` would block them; `credentialless`
  //  unlocks SAB while tolerating no-CORS cross-origin subresources.
  //  Why /app/tools: covers the TTS tool today and any future in-browser
  //  WASM-based tools (image generators, audio editors) without further edits.
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
    '@local-monorepo/templates',
    '@local-monorepo/bulk-scheduler',
    '@local-monorepo/ai-tools',
  ],

  modules: ['@nuxtjs/seo', '@nuxtjs/i18n', '@nuxt/hints', 'nuxt-umami', 'evlog/nuxt', '@comark/nuxt', '@nuxtjs/mcp-toolkit'],
  mcp: {
    name: 'MagicSync MCP',
    route: '/mcp',
  },
  i18n: {
    vueI18n: join(currentDir, './translations/i18n.config.ts'),
    // NUXT_APP_URL is unset in some deploys (Coolify) — fall back instead of
    // emitting "baseUrl is required" on every SSR render. Must stay an
    // absolute production URL for valid SEO hreflang/canonical tags.
    baseUrl: process.env.NUXT_APP_URL || process.env.NUXT_BASE_URL || process.env.APP_URL || 'https://magicsync.dev',
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
  site: {
    url: "https://magicsync.dev",
    name: "MagicSync - Social Media Management Made Easy"
  },
  sitemap: {
    exclude: [
      '/app/**',
      // Dev/internal routes must never appear in the sitemap. They are ALSO
      // noindexed via routeRules below (robots.txt blocking would prevent
      // Google from re-crawling and honoring the noindex).
      '/ui-preview/**',
      '/twitter-mock',
      '/_scripts',
      // Duplicate homepage variant — now 301'd to `/`.
      '/home',
    ],
  },
  robots: {
    disallow: [
      '/app/**',
    ]
  },
  ogImage: {
    // zeroRuntime: true causes issues with dynamic content pages that use
    // defineOgImage(page.value?.ogImage) — disable for stability
  },
  umami: {
    id: '55b75e65-727f-44ae-9f58-c2d67c2f3b4b',
    host: 'https://umami.giessen.dev',
    autoTrack: true,
    ignoreLocalhost: true
  },
  evlog: {
    env: {
      service: 'layer-site',
    },
    // Optional: only log specific routes (supports glob patterns)
    include: ['/api/**'],
    // Optional: exclude specific routes from logging
    exclude: ['/api/_nuxt_icon/**'],
  },
  // Header rules live at top level (not under `nitro:`) so that
  // Nuxt applies them through both production (Nitro) and dev mode.
  // (Consolidated into the single `routeRules` block above — a duplicate
  // key here used to silently overwrite the redirect/noindex rules.)
  vite: {
    // papaparse must stay out of the SSR bundle: it builds a Web-Worker from
    // a stringified function and Vite's SSR transform rewrites `typeof window`
    // inside that string, emitting unparseable JS that kills the build at
    // Nitro prerender (`RollupError: Expected ',', got 'undefined'`). Kept as
    // a runtime import instead (bulk-scheduler csvParser, used client-side by
    // csv-import/generate pages and server-side by csv-import.post.ts).
    ssr: {
      external: ['papaparse'],
    },
    // Vite dev-server must also send the isolation headers so `/_nuxt/*`,
    // `/@fs/*`, and `/@vite/*` responses carry them. Without this, the page
    // HTML gets COOP/COEP via Nitro but the JS modules don't, so the page
    // still reports `crossOriginIsolated === false`.
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
    build: {
      rollupOptions: {
        external: [
          "sharp"
        ]
      }
    }
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
    },
    'vite:config': (viteConfig) => {
      if (viteConfig.plugins) {
        for (const p of viteConfig.plugins) {
          if (p && typeof p === 'object' && 'name' in p &&
              (p.name === '@tailwindcss/vite:generate:serve' || p.name === '@tailwindcss/vite:generate:build') &&
              'transform' in p) {
            const transform = p.transform as any
            if (transform?.filter?.id?.exclude) {
              transform.filter.id.exclude.push(/[?&]direct\b/)
            }
          }
        }
      }
    },
    'vite:extendConfig': (viteInlineConfig) => {
      // NUXT_B7002: @nuxt/content and @nuxtjs/mdc register
      // vite.optimizeDeps.include entries (slugify, remark-*, rehype-*,
      // parse5, unist-util-visit, unified, debug, extend) that cannot be
      // resolved in dev. This hook runs after all `vite:config` hooks
      // (including the modules'), so filtering here actually sticks.
      // The modules work fine without pre-bundling these.
      const optimizeDeps = (viteInlineConfig as { optimizeDeps?: { include?: unknown[] } }).optimizeDeps
      if (optimizeDeps?.include) {
        const unresolvable = new Set([
          'slugify',
          'remark-gfm',
          'remark-emoji',
          'remark-mdc',
          'remark-rehype',
          'rehype-raw',
          'parse5',
          'unist-util-visit',
          'unified',
          'debug',
          'extend',
        ])
        optimizeDeps.include = optimizeDeps.include.filter((entry) => {
          if (typeof entry !== 'string') return true
          const leaf = entry.split('>').pop()?.trim() ?? entry
          return !unresolvable.has(leaf)
        })
      }
    },
  }
})
