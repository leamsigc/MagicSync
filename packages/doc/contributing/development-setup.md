---
category: Contributing
---

# Development Setup

This guide will help you set up a local development environment for contributing to MagicSync.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.0.0 or higher
- **pnpm**: v10.19.0 or higher
- **Git**: Latest version

## Initial Setup

### 1. Fork and Clone

First, fork the repository on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/magicsync.git
cd magicsync
```

### 2. Enable Corepack

Corepack ensures you use the correct package manager version:

```bash
corepack enable
```

### 3. Install Dependencies

Install all project dependencies:

```bash
pnpm install
```

This installs dependencies for all workspace packages.

### 4. Set Up Environment Variables

```bash
cp .env-example .env
```

Edit `.env` with your configuration. See [Platform Keys](/guide/platform-keys) for obtaining API keys.

## Development Workflow

### Running the Development Server

Start all development servers:

```bash
pnpm site:dev
```

Access the application at `http://localhost:3000`

### Running Individual Packages

```bash
# Database layer
cd packages/db && pnpm dev

# UI layer
cd packages/ui && pnpm dev

# Documentation
cd packages/doc && pnpm dev
```

### Building for Production

```bash
# Build all packages
pnpm build

# Build main site
pnpm site:build
```

### Database Setup

MagicSync uses Turso (libSQL) with Drizzle ORM.

#### Generate Database Migrations

```bash
cd packages/db
pnpm db:generate
```

#### Apply Migrations

```bash
cd packages/db
pnpm db:migrate
```

## Project Structure

```
magicsync/
├── packages/
│   ├── db/              # Database layer
│   │   ├── server/
│   │   │   ├── services/ # Business logic & plugins
│   │   │   └── database/ # Schemas & migrations
│   │   └── package.json
│   ├── auth/             # Authentication layer
│   ├── ui/               # UI components (Nuxt UI wrappers)
│   ├── assets/           # Static assets
│   ├── scheduler/        # Post scheduling
│   ├── bulk-scheduler/   # Bulk operations
│   ├── connect/          # Platform OAuth
│   ├── tools/            # In-browser tools
│   ├── ai-tools/         # AI content generation
│   ├── content/          # Blog & static content
│   ├── email/            # Email templates
│   ├── site/             # Main application (layer merge point)
│   └── doc/              # Documentation (VitePress)
├── .env-example          # Environment template
├── pnpm-workspace.yaml   # pnpm workspace config
└── package.json          # Root package.json
```

## Layer Package Commands

| Layer | Dev Command |
|-------|-------------|
| site | `pnpm site:dev` |
| db | `cd packages/db && pnpm dev` |
| ui | `cd packages/ui && pnpm dev` |
| doc | `cd packages/doc && pnpm dev` |

## Code Quality

### Linting

```bash
pnpm lint
```

### Type Checking

```bash
pnpm typecheck
```

## Debugging

### Debugging API Routes

1. Check server logs in the terminal
2. Use Nuxt DevTools (automatically available in dev mode)
3. Add `console.log()` statements in `packages/*/server/api/`

### Debugging Platform Integrations

When working on platform plugins in `packages/*/server/services/`:

1. Check the plugin file for the specific platform
2. Verify API credentials in `.env`
3. Use the platform's API documentation for reference

### Debugging Database Issues

1. Check the schema in `packages/db/server/database/schema/`
2. Verify migrations in `packages/db/drizzle/`
3. Use Drizzle Studio: `cd packages/db && pnpm db:studio`

## Common Issues

### Port Already in Use

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm site:dev
```

### Environment Variables Not Loading

1. Ensure `.env` exists in the root directory
2. Restart the dev server
3. Check that variables are prefixed with `NUXT_` for Nuxt runtime config

### Database Connection Errors

1. Check `DATABASE_URL` in `.env`
2. For Turso, verify your auth token
3. For local development, ensure the database file path is writable

## Next Steps

Now that you have your development environment set up:

- Read the [Architecture](contributing/architecture) guide
- Learn about [Adding Features](contributing/adding-features)
- Check the [Documentation](contributing/documentation) guide

## Getting Help

If you encounter issues:

- Check existing [GitHub Issues](https://github.com/leamsigc/magicsync/issues)
- Open a new issue with details
- Ask in [GitHub Discussions](https://github.com/leamsigc/magicsync/discussions)