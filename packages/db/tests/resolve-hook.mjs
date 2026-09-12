import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Repo-relative resolution for service tests: Nuxt layer aliases and the
// drizzle helper are mapped to real files (or the test stub) so services can
// be imported in plain Node with type stripping. No production code changes.
const DB = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ROOT = path.dirname(path.dirname(DB))
const SITE_PKG = path.join(ROOT, 'packages', 'site', 'package.json')

const LAYER_PREFIXES = {
  '#layers/BaseDB/': DB,
  '#layers/BaseShared/': path.join(ROOT, 'packages', 'shared'),
  '#layers/BaseConnect/': path.join(ROOT, 'packages', 'connect'),
  '#layers/BaseAuth/': path.join(ROOT, 'packages', 'auth'),
  '#layers/BaseEmail/': path.join(ROOT, 'packages', 'email'),
  '#layers/BaseAITools/': path.join(ROOT, 'packages', 'ai-tools'),
  '#ai-tools/': path.join(ROOT, 'packages', 'ai-tools'),
}

function withTsExtension(candidate) {
  if (fs.existsSync(`${candidate}.ts`)) return `${candidate}.ts`
  if (fs.existsSync(candidate)) return candidate
  return null
}

export async function resolve(specifier, context, next) {
  // The real drizzle helper connects to Turso; tests inject a file DB instead.
  if (specifier === '#layers/BaseDB/server/utils/drizzle') {
    return {
      url: pathToFileURL(path.join(DB, 'tests', 'stubs', 'drizzle-stub.mjs')).href,
      shortCircuit: true,
    }
  }
  // Parameter properties are not strip-compatible; behavior-compatible stub.
  if (specifier === '#layers/BaseShared/server/types/errors') {
    return {
      url: pathToFileURL(path.join(DB, 'tests', 'stubs', 'errors-stub.mjs')).href,
      shortCircuit: true,
    }
  }
  // The real helper boots the better-auth stack (background queries); stub it.
  if (specifier === '#layers/BaseAuth/server/utils/AuthHelpers') {
    return {
      url: pathToFileURL(path.join(DB, 'tests', 'stubs', 'auth-helpers-stub.mjs')).href,
      shortCircuit: true,
    }
  }
  // Type-only export imported as a value; stub it for runtime loading.
  if (specifier === '#layers/BaseConnect/utils/FacebookPages') {
    return {
      url: pathToFileURL(path.join(DB, 'tests', 'stubs', 'facebook-pages-stub.mjs')).href,
      shortCircuit: true,
    }
  }
  for (const [prefix, dir] of Object.entries(LAYER_PREFIXES)) {
    if (specifier.startsWith(prefix)) {
      const resolved = withTsExtension(path.join(dir, specifier.slice(prefix.length)))
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
      break
    }
  }
  // Extensionless relative imports inside .ts sources (Bundler-style).
  if (
    (specifier.startsWith('./') || specifier.startsWith('../'))
    && context.parentURL?.endsWith('.ts')
  ) {
    const resolved = withTsExtension(path.join(path.dirname(fileURLToPath(context.parentURL)), specifier))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }
  // zod is a transitive workspace dep; resolve it through the site package.
  if (specifier === 'zod') {
    return next(specifier, { ...context, parentURL: pathToFileURL(SITE_PKG).href })
  }
  // h3 ships with the framework, not the db package; map to the pinned copy.
  if (specifier === 'h3') {
    return {
      url: pathToFileURL(path.join(ROOT, 'node_modules', '.pnpm', 'h3@1.15.10', 'node_modules', 'h3', 'dist', 'index.mjs')).href,
      shortCircuit: true,
    }
  }
  return next(specifier, context)
}
