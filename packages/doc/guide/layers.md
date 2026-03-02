# Project Layers

The MagicSync monorepo is organized into several distinct layers, each responsible for a specific part of the application.

## UI Layer (`packages/ui`)

The base design system and shared component library.

- **Framework**: Nuxt 4
- **UI Library**: Nuxt UI v4 (Radix Vue + Tailwind CSS)
- **Features**: Global components, layouts, CSS design tokens, color mode, MDC/Comark rendering (`ui.mdc: true`)
- **Key Modules**: `@nuxt/ui`, `@nuxt/image`, `@vueuse/nuxt`, `@vueuse/motion/nuxt`, `@nuxtjs/i18n`

## Auth Layer (`packages/auth`)

Authentication and user management.

- **Library**: Better Auth
- **Features**: Session management, login/register pages, auth middleware, server routes

## Database Layer (`packages/db`)

Drizzle ORM schema, migrations, and database utilities.

- **ORM**: Drizzle ORM
- **Database**: Turso (LibSQL)
- **Includes**: Schema definitions, migration files, query helpers

## AI Tools Layer (`packages/ai-tools`)

AI-powered growth strategy and content pipeline tools.

- **Features**:
  - **Growth Strategy**: Tabbed dashboard with Comark-rendered action plans (7/30/90 days), editable with localStorage persistence
  - **Content Pipeline**: Full script-to-publish workflow with hook variations, AI hook health analysis (Gemini 2.0 Flash), teleprompter focus mode with camera/recording, edit checklist, upload
  - **Data Analytics**: Reactive algorithmic diagnostics from post metrics
- **AI**: Google Gemini 2.0 Flash via server-side REST API
- **Key Modules**: `@nuxtjs/i18n`, `evlog/nuxt`

## Assets Layer (`packages/assets`)

Shared static assets (images, fonts, icons).

## Scheduler Layer (`packages/scheduler`)

Background jobs and scheduling for social media posts.

- **Core Functionality**: Scheduling posts, managing queues
- **Plugins**: Platform-specific implementations (e.g., Twitter, LinkedIn)

## Bulk Scheduler Layer (`packages/bulk-scheduler`)

CSV-based bulk content import and scheduling.

## Connect Layer (`packages/connect`)

Social media platform OAuth connections and API integrations.

## Content Layer (`packages/content`)

Nuxt Content-based blog and static content management.

## Email Layer (`packages/email`)

Transactional email templates and sending utilities.

## Site Layer (`packages/site`)

Main consumer application that extends all layers.

- **Extends**: `ui`, `auth`, `db`, `ai-tools`, `assets`, `connect`, `scheduler`, `bulk-scheduler`
- **Key Modules**: `@nuxtjs/seo`, `@nuxtjs/i18n`, `nuxt-umami`, `evlog/nuxt`

## Documentation Layer (`packages/doc`)

This documentation site, built with **VitePress**.

- **Purpose**: Project documentation, guides, and API references
- **Sections**: Guide, API reference, Contributing, Troubleshooting
