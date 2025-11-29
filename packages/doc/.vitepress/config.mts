import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import llmstxt from 'vitepress-plugin-llms'
import { join } from 'node:path'
import { ContributorsPlugin, ChangelogPlugin, MetadataPlugin } from './plugins'

// Pass metadata file paths instead of loaded data
// This allows plugins to load data lazily at build time
const metadataDir = join(__dirname, '../metadata')
const metadataIndexPath = join(metadataDir, 'index.json')
const contributorsDataPath = join(metadataDir, 'contributors.json')
const changelogDataPath = join(metadataDir, 'changelog.json')

// https://vitepress.dev/reference/site-config
export default withMermaid(defineConfig({
  title: 'MagicSync',
  description: 'The ultimate social media management platform. Schedule, analyze, and grow your audience.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  base: '/magicsync/',

  vite: {
    plugins: [
      llmstxt(),
      MetadataPlugin(metadataIndexPath),
      ContributorsPlugin(contributorsDataPath),
      ChangelogPlugin(changelogDataPath),
    ],
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700&display=swap' }],
    ['meta', { name: 'theme-color', content: '#F05D06' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:title', content: 'MagicSync | Social Media Management' }],
    ['meta', { name: 'og:site_name', content: 'MagicSync' }],
    ['meta', { name: 'og:image', content: '/og-image.svg' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: '/og-image.svg' }],
  ],

  themeConfig: {
    logo: { src: '/logo.svg', width: 40, height: 40 },

    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Ecosystem', link: '/ecosystem/tooling', activeMatch: '/ecosystem/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
        {
          text: 'Project Overview',
          collapsed: false,
          items: [
            { text: 'Layers', link: '/guide/layers' },
            { text: 'Roadmap', link: '/guide/roadmap' },
          ],
        },
        {
          text: 'Guides',
          collapsed: false,
          items: [
            { text: 'Docker Setup', link: '/guide/docker-setup' },
            { text: 'Platform Keys', link: '/guide/platform-keys' },
          ],
        },
      ],
      '/ecosystem/': [
        {
          text: 'Ecosystem',
          items: [
            { text: 'Tooling', link: '/ecosystem/tooling' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/leamsigc/magicsync' },
    ],

    editLink: {
      pattern: 'https://github.com/leamsigc/magicsync/edit/main/packages/doc/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present MagicSync - Leamsigc (Documentation is base on https://nitro-graphql.pages.dev/)',
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    codeTransformers: [
      {
        // Code group support
        name: 'code-group-transformer',
        preprocess(code) {
          return code
        },
      },
    ],
  },

  sitemap: {
    hostname: 'https://magicsync.dev',
  },
}))
