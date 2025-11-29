---
category: Contributing
---

# Architecture

<FunctionInfo fn="architecture"/>

This guide provides an overview of the MagicSync architecture to help you understand how the application works.

## Overview

MagicSync is built as a Nuxt 4 monorepo application with the following key components:

- **Frontend**: Nuxt 4 with Vue 3 and Nuxt UI v4
- **Backend**: Nuxt server with API routes
- **Database**: LibSQL (Turso) with Drizzle ORM
- **Social Media Integrations**: Plugin-based architecture

## Monorepo Structure

```
magicsync/
├── packages/
│   ├── scheduler/          # Main application
│   ├── content/            # Marketing site
│   ├── ui/                 # Shared UI components
│   ├── site/               # Additional pages
│   └── doc/                # Documentation
```

## Main Application (`packages/scheduler`)

### Directory Structure

```
scheduler/
├── app/                    # Nuxt app (frontend)
│   ├── pages/              # Vue pages
│   ├── components/         # Vue components
│   ├── composables/        # Vue composables
│   └── layouts/            # Page layouts
├── server/                 # Nuxt server (backend)
│   ├── api/                # API routes
│   ├── services/           # Business logic
│   │   └── plugins/        # Social media platform plugins
│   ├── database/           # Database schemas
│   │   ├── schema/         # Drizzle schemas
│   │   └── migrations/     # Database migrations
│   └── utils/              # Server utilities
├── public/                 # Static assets
└── nuxt.config.ts          # Nuxt configuration
```

## Key Concepts

### Social Media Plugins

Each social media platform is implemented as a plugin in `server/services/plugins/`:

```typescript
// Example: facebook.plugin.ts
export const facebookPlugin = {
  name: 'facebook',
  
  async post(content: PostContent, credentials: Credentials) {
    // Implementation for posting to Facebook
  },
  
  async getProfile(credentials: Credentials) {
    // Get user profile from Facebook
  },
  
  // Other methods...
}
```

### API Routes

API routes are defined in `server/api/` and follow Nuxt's file-based routing:

```
server/api/
├── posts/
│   ├── create.post.ts      # POST /api/posts/create
│   ├── schedule.post.ts    # POST /api/posts/schedule
│   └── [id].get.ts         # GET /api/posts/:id
├── platforms/
│   ├── connect.post.ts     # POST /api/platforms/connect
│   └── list.get.ts         # GET /api/platforms/list
└── auth/
    └── [...].ts            # Auth endpoints
```

### Database Schema

Database schemas are defined using Drizzle ORM in `server/database/schema/`:

```typescript
// Example: posts.ts
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
  platforms: text('platforms', { mode: 'json' }).$type<string[]>(),
  // ... other fields
})
```

### State Management

The application uses Vue composables for state management:

```typescript
// composables/usePosts.ts
export const usePosts = () => {
  const posts = ref([])
  
  const fetchPosts = async () => {
    const data = await $fetch('/api/posts/list')
    posts.value = data
  }
  
  return {
    posts,
    fetchPosts
  }
}
```

## Data Flow

1. **User Action** → Vue component
2. **Component** → Composable or direct API call
3. **API Route** → Service layer
4. **Service** → Database or external API (social media platform)
5. **Response** → Back through the chain to update UI

## Authentication

Authentication is handled using Nuxt Auth (or similar):

- Session management
- OAuth for social media platforms
- JWT tokens for API authentication

## Deployment

### Self-Hosted (Docker)

The application can be self-hosted using Docker Compose:

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=...
```

### Cloud Deployment

Can be deployed to:
- Vercel
- Netlify
- Cloudflare Pages
- Any Node.js hosting

## Performance Considerations

- **Database**: Uses LibSQL for edge-ready performance
- **Caching**: Implements caching for API responses
- **Image Optimization**: Uses Nuxt Image for optimized images
- **Code Splitting**: Automatic code splitting with Nuxt

## Security

- Environment variables for sensitive data
- API rate limiting
- Input validation and sanitization
- CORS configuration
- Secure session management

## Next Steps

- Review [Development Setup](/contributing/development-setup)
- Learn about [Adding Features](/contributing/adding-features)
- Check [Documentation](/contributing/documentation) standards

---

## Source
<SourceLinks fn="architecture"/>

## Contributors
<Contributors fn="architecture"/>

## Changelog
<Changelog fn="architecture"/>
