---
category: Contributing
---

# Development Setup

<FunctionInfo fn="developmentSetup"/>

This guide will help you set up a local development environment for contributing to MagicSync.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.0.0 or higher
- **pnpm**: v10.19.0 or higher (specified in package.json)
- **Git**: Latest version
- **Docker** (optional): For testing self-hosted deployment

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

Install all project dependencies using pnpm:

```bash
pnpm install --frozen-lockfile
```

This will install dependencies for:
- All workspace packages (scheduler, content, ui, site, doc)
- The monorepo tooling

### 4. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env-example .env
```

Edit `.env` and configure the required variables. See the [Platform Keys](/guide/platform-keys) guide for obtaining API keys for social media platforms.

## Development Workflow

### Running the Development Server

The project is organized as a monorepo with multiple packages. You can run them individually or together.

#### Run All Services

Start all development servers concurrently:

```bash
pnpm dev
```

This starts:
- **Scheduler** (`packages/scheduler`) - Main application server on port 3000
- **Content Site** (`packages/content`) - Marketing/landing pages
- **Documentation** (`packages/doc`) - Documentation site

#### Run Individual Packages

Run a specific package:

```bash
# Scheduler (main app)
pnpm --filter @magicsync/scheduler dev

# Documentation
pnpm doc

# Content site
pnpm --filter @magicsync/content dev
```

### Building for Production

Build all packages:

```bash
pnpm build
```

Build specific packages:

```bash
# Build scheduler
pnpm --filter @magicsync/scheduler build

# Build documentation
pnpm doc:build
```

### Database Setup

MagicSync uses LibSQL (Turso) with Drizzle ORM.

#### Local Development

For local development, the database runs in-memory or uses a local SQLite file.

#### Generate Database Migrations

After modifying database schemas:

```bash
cd packages/scheduler
pnpm db:generate
```

#### Apply Migrations

```bash
cd packages/scheduler
pnpm db:migrate
```

#### View Database

Open Drizzle Studio to inspect the database:

```bash
cd packages/scheduler
pnpm db:studio
```

## Testing with Docker

Test the self-hosted deployment:

```bash
docker compose up -d
```

This starts:
- MagicSync application
- Database
- Any required services

Access the application at `http://localhost:3000`

Stop the containers:

```bash
docker compose down
```

## Code Quality

### Linting

Check code quality and style:

```bash
pnpm lint
```

Automatically fix linting issues:

```bash
pnpm lint:fix
```

The project uses ESLint with custom configuration.

### Type Checking

TypeScript type checking:

```bash
pnpm typecheck
```

### Formatting

Format code with Prettier:

```bash
pnpm format
```

## Development Commands Reference

Here's a complete reference of available commands:

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Run all dev servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Check code quality |
| `pnpm lint:fix` | Auto-fix linting issues |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm format` | Format code with Prettier |
| `pnpm doc` | Run documentation dev server |
| `pnpm doc:build` | Build documentation |
| `pnpm clean` | Clean all build artifacts |

## Project Structure

Understanding the monorepo structure:

```
magicsync/
├── packages/
│   ├── scheduler/              # Main application
│   │   ├── server/             # Nuxt server code
│   │   │   ├── api/            # API routes
│   │   │   ├── services/       # Business logic
│   │   │   │   └── plugins/    # Social media platform integrations
│   │   │   ├── database/       # Database schemas & migrations
│   │   │   └── utils/          # Server utilities
│   │   ├── app/                # Nuxt app (pages, components)
│   │   ├── composables/        # Vue composables
│   │   └── nuxt.config.ts      # Nuxt configuration
│   ├── content/                # Marketing/landing pages
│   ├── ui/                     # Shared UI components (Nuxt UI)
│   ├── site/                   # Additional site pages
│   └── doc/                    # Documentation (VitePress)
│       ├── .vitepress/         # VitePress config & theme
│       ├── guide/              # User guides
│       └── contributing/       # Contributing docs
├── docker-compose.yml          # Docker setup
├── .env-example                # Environment variables template
├── pnpm-workspace.yaml         # pnpm workspace config
└── package.json                # Root package.json
```

## Debugging Tips

### Debugging API Routes

When working on server API routes:

1. Check server logs in the terminal
2. Use the Nuxt DevTools (automatically available in dev mode)
3. Add `console.log()` statements in `packages/scheduler/server/api/`

### Debugging Social Media Integrations

When working on platform plugins (`packages/scheduler/server/services/plugins/`):

1. Check the plugin file for the specific platform (e.g., `facebook.plugin.ts`)
2. Verify API credentials in `.env`
3. Use the platform's API documentation for reference
4. Test with the platform's developer tools/sandbox

### Debugging Database Issues

If you encounter database problems:

1. Check the schema in `packages/scheduler/server/database/schema/`
2. Verify migrations in `packages/scheduler/drizzle/`
3. Use Drizzle Studio to inspect data: `pnpm db:studio`
4. Check database connection in `.env`

### Debugging Build Issues

If builds fail:

1. Clean build artifacts:
   ```bash
   pnpm clean
   ```

2. Remove node_modules and reinstall:
   ```bash
   rm -rf node_modules
   pnpm install --frozen-lockfile
   ```

3. Check for TypeScript errors:
   ```bash
   pnpm typecheck
   ```

## Common Issues

### Port Already in Use

If port 3000 is already in use:

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

### Environment Variables Not Loading

If environment variables aren't working:

1. Ensure `.env` exists in the root directory
2. Restart the dev server
3. Check that variables are prefixed with `NUXT_` for Nuxt runtime config

### Database Connection Errors

If you can't connect to the database:

1. Check `NUXT_DATABASE_URL` in `.env`
2. For Turso, verify your auth token is correct
3. For local development, ensure the database file path is writable

## Next Steps

Now that you have your development environment set up:

- Read the [Architecture](/contributing/architecture) guide to understand the codebase
- Learn about [Adding Features](/contributing/adding-features)
- Check the [Documentation](/contributing/documentation) guide for writing docs

## Getting Help

If you encounter issues during setup:

- Check existing [GitHub Issues](https://github.com/leamsigc/magicsync/issues)
- Open a new issue with details about your setup
- Ask in [GitHub Discussions](https://github.com/leamsigc/magicsync/discussions)

---

## Source
<SourceLinks fn="developmentSetup"/>

## Contributors
<Contributors fn="developmentSetup"/>

## Changelog
<Changelog fn="developmentSetup"/>
