# MagicSync

**Social media scheduling platform built with Nuxt 4 monorepo** — Schedule posts across Facebook, Twitter/X, Instagram, Bluesky, LinkedIn, and more with AI-powered content generation.

![Home](./images/HomePage.png)
![Calendar](./images/Screenshot%202025-12-05%20at%2001-54-56%20Month%20Calendar%20%40local-monorepo_site.png)
![Dashboard](./images/homeImage.png)

---

## What is MagicSync?

MagicSync is a comprehensive social media management platform that enables you to:

- **Connect multiple platforms** — Facebook, Twitter/X, Instagram, Bluesky, LinkedIn, TikTok, YouTube, Threads, Reddit, Dribbble, WordPress
- **Schedule posts** — Plan content with a powerful calendar view (Month, Week, Day)
- **AI-powered content generation** — Generate engaging posts using AI based on your business details
- **Bulk scheduling** — Create and schedule multiple posts at once across date ranges
- **Media management** — Upload, organize, and manage your images and videos
- **Template system** — Use variable templates and chat templates for consistent branding
- **In-browser tools** — Image editor, video silence remover, social media & email preview generators

---

## Features

### Platform Connections
![Connected Platforms](./images/Screenshot%202025-12-05%20at%2001-57-26%20Connected%20social%20media%20platforms%20%40local-monorepo_site.png)
![Connect Account](./images/Screenshot%202025-12-05%20at%2001-57-33%20Connect%20your%20Connect%20account%20%40local-monorepo_site.png)

Connect all your social media accounts in one place and manage them from a unified dashboard.

### Post Creation & Scheduling
![All Posts](./images/Screenshot%202025-12-05%20at%2001-57-07%20All%20Posts%20%40local-monorepo_site.png)
![Bulk Create](./images/Screenshot%202025-12-05%20at%2001-54-46%20Bulk%20Create%20%40local-monorepo_site.png)

Create posts once and publish to multiple platforms simultaneously. Schedule them for optimal engagement times.

### Calendar View
![Calendar](./images/Screenshot%202025-12-05%20at%2001-55-07%20Month%20Calendar%20%40local-monorepo_site.png)
![Calendar](./images/Screenshot%202025-12-05%20at%2001-56-04%20Month%20Calendar%20%40local-monorepo_site.png)
![Calendar](./images/Screenshot%202025-12-05%20at%2001-56-22%20Month%20Calendar%20%40local-monorepo_site.png)

Visual calendar with Month, Week, and Day views. Hover on posts to preview them per platform.

### Media Management
![Media](./images/Screenshot%202025-12-05%20at%2001-54-30%20Media%20%40local-monorepo_site.png)
![Media](./images/Screenshot%202025-12-05%20at%2001-54-38%20Media%20%40local-monorepo_site.png)

Organize your media assets efficiently with upload, categorization, and easy access.

### AI Tools & Templates
![Chat Templates](./images/Screenshot%202025-12-05%20at%2001-57-46%20Chat%20Templates%20%40local-monorepo_site.png)
![Variable Templates](./images/Screenshot%202025-12-05%20at%2001-58-01%20Variable%20Templates%20%40local-monorepo_site.png)
![Business Management](./images/Screenshot%202025-12-05%20at%2001-57-39%20Business%20Management%20%40local-monorepo_site.png)

Generate AI-powered posts, use chat templates for consistent messaging, and manage business profiles.

### Built-in Tools
![Image Editor](./images/Screenshot%202025-10-17%20at%2011-20-51%20Image%20Editor%20%40local-monorepo_site.png)
![Upload](./images/Screenshot%202025-12-05%20at%2001-54-23%20Upload%20%40local-monorepo_site.png)

- **Image Editor** — Add text overlays to images
- **Video Silence Remover** — Automatically remove silent parts from videos
- **Social Media Preview** — Preview how posts look on each platform
- **Email Preview** — Test email rendering before sending

---

## Available Skill

MagicSync comes with a specialized skill for social media management:

| Skill | Description |
|-------|-------------|
| **magic-sync** | Create, schedule, and manage social media posts across multiple platforms |

### MagicSync Skill

Use the **magic-sync** skill to:
- Create social media posts with content validation
- Schedule posts across multiple platforms (Facebook, Twitter/X, Instagram, Bluesky, LinkedIn, etc.)
- Manage existing posts
- Generate platform-specific content
- Handle media attachments (images, videos)
- Configure per-platform content overrides

**Skill triggers:** "create social media post", "schedule post", "post to twitter", "post to instagram", "post to facebook", "post to bluesky", "post to linkedin", "social media", "cross-post"

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Nuxt 4, Vue 3, @nuxt/ui |
| Backend | Nuxt Server Routes, Better Auth |
| Database | Turso (libSQL) with native vector support |
| AI | LLM integration for content generation |
| Python Backend | FastAPI (optional, port 8000) |

---

## Project Structure

```
packages/
├── db/          # Database layer (Drizzle ORM, Turso)
├── auth/        # Authentication (Better Auth)
├── assets/      # Media upload & management
├── scheduler/   # Post scheduling & calendar
├── connect/     # Social platform connections
├── tools/       # In-browser tools (image editor, etc.)
├── ai-tools/    # AI content generation
├── bulk-scheduler/  # Bulk post creation & scheduling
├── content/     # Static content & blog
├── ui/          # Base UI components (@nuxt/ui wrappers)
├── email/       # Email templates & service
├── site/        # Main application (layer merge point)
```

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env-example .env
# Edit .env with your API keys

# Initialize database
cd packages/db && pnpm db:generate && pnpm db:migrate

# Start development
pnpm site:dev
```

---

## Commands

| Command | Description |
|---------|-------------|
| `pnpm site:dev` | Start dev server (port 3000) |
| `pnpm build` | Build all packages |
| `pnpm site:build` | Build main site |
| `pnpm ui:lint` | Lint UI components |
| `cd packages/db && pnpm db:generate` | Generate database schema |
| `cd python-backend && pnpm dev` | Start FastAPI backend (port 8000) |

---

## Currently Working

- User registration and login
- Assets management
- Tools (Image Editor, Video Silence Remover)
- Platform connections (Google, Facebook, Twitter, Instagram, Bluesky, LinkedIn, etc.)
- Post creation with multi-platform targeting
- Calendar view (Month, Week, Day)
- Hover preview on scheduled posts
- Chat templates & variable templates
- Business profile management

---

## Follow the Journey

[![Facebook](https://img.shields.io/badge/Facebook-@magicsyncdotdev-1877F2?style=flat&logo=facebook)](https://www.facebook.com/MagicSyncdordev)
[![Instagram](https://img.shields.io/badge/Instagram-@magicsyncdotdev-E4405F?style=flat&logo=instagram)](https://www.instagram.com/magicsyncdotdev/)
[![X](https://img.shields.io/badge/X-@magicsyncdotdev-000000?style=flat&logo=x)](https://twitter.com/magicsyncdotdev)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-magicsyncdotdev-0A66C2?style=flat&logo=linkedin)](https://www.linkedin.com/in/magicsyncdotdev/)

---

## License

MIT