import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '#layers/BaseDB/db/schema'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '..', '..', 'db', 'db', 'migrations')

// Credential envelopes require a secret; tests stay hermetic.
process.env.NUXT_PUBLISH_SECRET ??= 'test-publish-secret'
process.env.MACHINE_BRIDGE_SECRET ??= 'test-bridge-secret'

// Fresh file-backed SQLite with every committed migration applied in order.
// Mirrors a new Turso database for agent service tests.
export async function initTestDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msync-agent-test-'))
  const client = createClient({ url: `file:${path.join(dir, 'test.db')}` })
  const files = fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    const statements = sql.split('--> statement-breakpoint')
    for (const raw of statements) {
      const statement = raw.trim().replace(/;$/, '')
      if (statement) await client.execute(statement)
    }
  }
  const db = drizzle(client, { schema })
  globalThis.__TEST_DB = db
  return {
    db,
    client,
    schema,
    async cleanup() {
      globalThis.__TEST_DB = undefined
      client.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

export async function insertUser(db, { id, email }) {
  await db.insert(schema.user).values({ id, name: 'Test User', email })
}

export async function insertBusiness(db, { id, userId, name }) {
  await db.insert(schema.businessProfiles).values({ id, userId, name })
}
