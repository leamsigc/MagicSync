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

1. Create a new plugin file in `packages/scheduler/server/services/plugins/`
2. Follow the existing plugin pattern (see `facebook.plugin.ts` or `twitter.plugin.ts`)
3. Implement required methods: `post()`, `getProfile()`, etc.
4. Add platform configuration to the database schema
5. Update the UI to include the new platform

**Adding API Endpoints:**

Create new routes in `packages/scheduler/server/api/`:

```typescript
// packages/scheduler/server/api/posts/schedule.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Your logic here
  
  return {
    success: true,
    data: result
  }
})
```

**Adding UI Components:**

Add components to `packages/scheduler/app/components/` or `packages/ui/components/`:

```vue
<template>
  <div class="your-component">
    <!-- Your component template -->
  </div>
</template>

<script setup lang="ts">
// Your component logic
</script>
```

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
pnpm dev

# Test in the browser
# Navigate to http://localhost:3000

# Run type checking
pnpm typecheck

# Run linter
pnpm lint
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
