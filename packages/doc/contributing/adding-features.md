---
category: Contributing
---

# Adding Features

<FunctionInfo fn="addingFeatures"/>

This guide walks you through adding new features to MagicSync, from development to submitting a pull request.

## Before You Start

1. **Check existing issues** - Search for related issues or discussions
2. **Open an issue** - Discuss your feature idea before implementing
3. **Get feedback** - Wait for maintainer feedback on larger features
4. **Fork the repo** - Create your own fork to work in

## Development Process

### 1. Set Up Your Environment

Follow the [Development Setup](/contributing/development-setup) guide.

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/magicsync.git
cd magicsync

# Install dependencies
pnpm install

# Start development mode
pnpm dev
```

### 2. Create a Feature Branch

Use descriptive branch names:

```bash
# For new features
git checkout -b feat/your-feature-name

# For bug fixes
git checkout -b fix/bug-description

# For documentation
git checkout -b docs/update-description
```

**Examples:**
- `feat/tiktok-integration`
- `feat/bulk-post-scheduling`
- `fix/instagram-image-upload`
- `docs/platform-setup-guide`

### 3. Implement Your Feature

#### Common Feature Types

**Adding a New Social Media Platform:**

1. Add the connection flow to the owning layer (`packages/connect/server/`)
2. Follow the existing provider patterns and OAuth callback conventions
3. Add any new fields to the schema in `packages/db/db/socialMedia/`
4. Update the integrations UI and platform icons in `packages/ui`

**Adding API Endpoints:**

Routes live in the layer that owns the feature (`packages/<layer>/server/api/v1/...`). Keep handlers thin — auth, zod validation, access checks, then a service call:

```typescript
// packages/<layer>/server/api/v1/things/index.post.ts
import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { thingService } from '#layers/BaseDB/server/services/thing.service'

const CreateSchema = z.object({ name: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = CreateSchema.parse(await readBody(event))
  const result = await thingService.create(user.id, body)
  if (!result.success) throw createError({ statusCode: 400, statusMessage: result.error })
  return { thing: result.data }
})
```

**Adding UI Components:**

Add components to the owning layer's `app/components/` (global) or page-local `app/pages/**/components/`. Pages carry an adjacent locale JSON (`<i18n src="./page.json">` on line 1) and use `const { t } = useI18n()`. Link pages from the business flow or navigation where relevant.

**Adding Database Tables:**

1. Add the table to `packages/db/db/<feature>/` and export it from `packages/db/db/schema.ts`
2. Generate a migration: `pnpm --filter @local-monorepo/db db:generate`
3. Add a service in `packages/db/server/services/` returning `ServiceResponse<T>`
4. Add a schema/service test under `packages/db/tests/`

**Adding Agent Tools and Workflows:**

Agent tools are server-owned and tenant-scoped — model arguments never select a business or user:

1. Create or extend a tool module in `packages/agent/server/agent/tools/`
2. Use `defineTool` with a `typebox` parameter schema; read identity from the injected `AgentToolContext`
3. Resolve data through services (`packages/db/server/services/` or `packages/agent/server/services/`), returning typed errors
4. Register the tool in `packages/agent/server/agent/tools/index.ts`
5. Add an optional built-in skill in `packages/db/server/services/agent-registry.service.ts`
6. Test it in `packages/agent/tests/` with the stub provider/fake clients — no network or API keys

If the tool talks to an external backend (scraper API, Python service), follow the settings pattern in [Tool Backends](/guide/tool-backends): store secrets encrypted, expose presence-only routes, and never trust client-supplied URLs for tenant identity.

Workflows are orchestrated in `packages/agent/server/services/agent-workflow.service.ts`; each step should record a `content_runs` row.

#### Code Style

Follow these guidelines:

**TypeScript:**
```typescript
// ✅ Use explicit types for public APIs
export function schedulePost(options: ScheduleOptions): Promise<Post>

// ✅ Prefer named exports
export function myFunction() {}

// ❌ Avoid default exports (except for Nuxt pages/API routes)
```

**Naming Conventions:**
- **Functions**: `camelCase` - `schedulePost`, `getPlatforms`
- **Types/Interfaces**: `PascalCase` - `PostData`, `PlatformConfig`
- **Constants**: `UPPER_SNAKE_CASE` - `MAX_FILE_SIZE`, `DEFAULT_TIMEOUT`
- **Files**: `kebab-case` - `post-scheduler.ts`, `platform-config.ts`

### 4. Add Documentation

Every feature needs documentation in `packages/doc/guide/`:

```markdown
# Your Feature Name

Brief description of what your feature does.

## Usage

Explain how to use the feature with examples.

## Configuration

List any configuration options.

## Examples

Provide practical examples.
```

### 5. Test Your Changes

```bash
# Run the development server
pnpm site:dev

# Test in the browser
# Navigate to http://localhost:3000

# Database service + schema tests (file SQLite, migrations applied)
pnpm --filter @local-monorepo/db test:services

# Agent tests (stub model provider; no network or API keys)
pnpm --filter @local-monorepo/agent test

# Production build (also validates new routes/pages)
pnpm site:build

# Structural diagnostics — new code must not add findings
pnpm dlx vite-doctor .
```

## Pull Request Process

### 1. Prepare Your Changes

```bash
# Run linter
pnpm lint:fix

# Build the project
pnpm build

# Test the application
pnpm dev
```

### 2. Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
type(scope): description
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Examples:**
```bash
git commit -m "feat: add TikTok integration"
git commit -m "feat(scheduler): add bulk post scheduling"
git commit -m "fix: resolve Instagram image upload issue"
git commit -m "docs: add platform setup guide"
```

### 3. Push to Your Fork

```bash
git push origin feat/your-feature-name
```

### 4. Create Pull Request

#### PR Title

Use the same format as commit messages:

```
feat: add TikTok integration
fix: resolve Instagram upload issues
docs: improve platform setup guide
```

#### PR Description

Fill out the template:

```markdown
## Description

Clear description of what this PR does and why.

## Related Issues

Closes #123

## Changes

- Added X feature
- Fixed Y bug
- Updated Z documentation

## Testing

- [x] Tested locally
- [x] Documentation updated
- [x] No breaking changes

## Screenshots (if applicable)

Add screenshots for UI changes
```

## Feature Checklist

Before submitting your PR:

- [ ] Code is properly typed
- [ ] Documentation written
- [ ] Tested locally
- [ ] Linter passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Commit messages follow conventions
- [ ] PR description is complete
- [ ] No breaking changes (or documented)

## Getting Help

- **Questions**: Ask in [GitHub Discussions](https://github.com/leamsigc/magicsync/discussions)
- **Bugs**: Report in [GitHub Issues](https://github.com/leamsigc/magicsync/issues)
- **Setup Issues**: Check [Development Setup](/contributing/development-setup)

---

## Source
<SourceLinks fn="addingFeatures"/>

## Contributors
<Contributors fn="addingFeatures"/>

## Changelog
<Changelog fn="addingFeatures"/>
