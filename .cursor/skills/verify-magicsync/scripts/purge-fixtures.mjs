#!/usr/bin/env node
/**
 * purge-fixtures.mjs — remove ONLY the throwaway users that verification runs
 * create. Bounded on purpose: the WHERE clause matches the exact fixture
 * marker used by createTestUser() in packages/site/tests/e2e/helpers/e2e-utils.ts.
 *
 * Never touches a real account, and never touches the database container.
 *
 * Usage: node purge-fixtures.mjs [repoRoot]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const repoRoot = process.argv[2] || process.cwd()
const envPath = join(repoRoot, '.env')

let env
try {
  env = readFileSync(envPath, 'utf8')
}
catch {
  console.error(`  cannot read ${envPath} — skipping fixture purge`)
  process.exit(0)
}

const read = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!match) throw new Error(`Missing ${key} in .env`)
  return match[1].trim()
}

// `@libsql/client` is a dependency of @local-monorepo/site, not of the repo
// root, and ESM resolves bare specifiers from this file's own location — which
// lives under .cursor/. Resolve it against the site package instead.
async function loadLibsql() {
  const requireFromSite = createRequire(join(repoRoot, 'packages/site/package.json'))
  const entry = requireFromSite.resolve('@libsql/client')
  return import(pathToFileURL(entry).href)
}

let client
try {
  const { createClient } = await loadLibsql()
  client = createClient({
    url: read('NUXT_TURSO_DATABASE_URL'),
    authToken: read('NUXT_TURSO_AUTH_TOKEN'),
  })
}
catch (error) {
  console.error(`  cannot connect to the database — skipping purge: ${error.message}`)
  process.exit(0)
}

// The marker createTestUser() stamps on every throwaway account.
const FIXTURE_MARKER = 'e2e-%@test.magicsync.dev'

// @libsql/client returns the ResultSet directly — there is no `.result`
// wrapper. Reading `.result` here silently yields zero rows and turns the
// purge into a no-op that still reports success.
const found = await client.execute({
  sql: 'SELECT id, email FROM user WHERE email LIKE ?',
  args: [FIXTURE_MARKER],
})
const rows = found?.rows ?? []

if (rows.length === 0) {
  console.log('  no fixture users found — nothing to purge')
  process.exit(0)
}

const { rows: recent } = await client.execute({
  sql: 'SELECT email FROM user WHERE email NOT LIKE ? ORDER BY created_at DESC LIMIT 5',
  args: [FIXTURE_MARKER],
})
const realCount = (await client.execute({
  sql: 'SELECT COUNT(*) AS c FROM user WHERE email NOT LIKE ?',
  args: [FIXTURE_MARKER],
})).rows[0].c

console.log(`  ${rows.length} fixture user(s) matched ${FIXTURE_MARKER}`)
console.log(`  ${realCount} real user(s) would be left untouched`)
console.log(`  most recent real accounts: ${recent.map(r => r.email).join(', ') || 'none'}`)
console.log(`  newest fixtures: ${rows.slice(-3).map(r => r.email).join(', ')}`)

if (process.argv.includes('--yes')) {
  const deleted = await client.execute({
    sql: 'DELETE FROM user WHERE email LIKE ?',
    args: [FIXTURE_MARKER],
  })
  console.log(`  purged ${deleted?.rowsAffected ?? 0} fixture user(s); their businesses and posts cascade with them`)
}
else {
  console.log('  dry run — re-run with --yes to actually delete them')
}