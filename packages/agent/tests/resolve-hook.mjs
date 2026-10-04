import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Repo-relative resolution for agent-layer tests: Nuxt layer aliases are mapped
// to real layer files so services import in plain Node (type stripping), and
// the drizzle helper is swapped for the shared test stub that targets the
// file-backed test DB installed by setup.mjs.
const AGENT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKAGES = path.dirname(AGENT)
const ROOT = path.dirname(PACKAGES)

const LAYER_PREFIXES = {
  '#layers/BaseAgent/': AGENT,
  '#layers/BaseDB/': path.join(PACKAGES, 'db'),
  '#layers/BaseShared/': path.join(PACKAGES, 'shared'),
  '#layers/BaseAuth/': path.join(PACKAGES, 'auth'),
}

function withTsExtension(candidate) {
  if (fs.existsSync(`${candidate}.ts`)) return `${candidate}.ts`
  if (fs.existsSync(path.join(candidate, 'index.ts'))) return path.join(candidate, 'index.ts')
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  return null
}

/** Vite-style `?raw` imports: resolve the file and serve its contents as a module. */
export async function load(url, context, next) {
  if (url.endsWith('?raw')) {
    const fileUrl = new URL(url)
    fileUrl.search = ''
    const source = fs.readFileSync(fileURLToPath(fileUrl), 'utf8')
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(source)}\n`,
    }
  }
  return next(url, context)
}

export async function resolve(specifier, context, next) {
  // `./file.md?raw` has no extension lookup; resolve straight to the real file.
  if (specifier.endsWith('?raw') && context.parentURL?.startsWith('file:')) {
    const candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier.slice(0, -4))
    if (fs.existsSync(candidate)) {
      return { url: `${pathToFileURL(candidate).href}?raw`, shortCircuit: true }
    }
  }
  // The real drizzle helper connects to Turso; tests inject a file DB instead.
  if (specifier === '#layers/BaseDB/server/utils/drizzle') {
    return {
      url: pathToFileURL(path.join(PACKAGES, 'db', 'tests', 'stubs', 'drizzle-stub.mjs')).href,
      shortCircuit: true,
    }
  }
  // Parameter properties are not strip-compatible; behavior-compatible stub.
  if (specifier === '#layers/BaseShared/server/types/errors') {
    return {
      url: pathToFileURL(path.join(PACKAGES, 'db', 'tests', 'stubs', 'errors-stub.mjs')).href,
      shortCircuit: true,
    }
  }
  // The real helper boots the better-auth stack (background queries); stub it.
  if (specifier === '#layers/BaseAuth/server/utils/AuthHelpers') {
    return {
      url: pathToFileURL(path.join(PACKAGES, 'db', 'tests', 'stubs', 'auth-helpers-stub.mjs')).href,
      shortCircuit: true,
    }
  }
  // Type-only export imported as a value; stub it for runtime loading.
  if (specifier === '#layers/BaseConnect/utils/FacebookPages') {
    return {
      url: pathToFileURL(path.join(PACKAGES, 'db', 'tests', 'stubs', 'facebook-pages-stub.mjs')).href,
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
    return next(specifier, { ...context, parentURL: pathToFileURL(path.join(ROOT, 'packages', 'site', 'package.json')).href })
  }
  return next(specifier, context)
}
