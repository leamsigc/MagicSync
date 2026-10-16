import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { tursoClient } from './drizzle'

/**
 * Apply pending Drizzle migrations against the configured libSQL database.
 *
 * Used by the site's boot plugin (DB_MIGRATE_ON_BOOT=1) so a fresh container
 * migrates itself before serving traffic. Idempotent: applied migrations are
 * recorded in `__drizzle_migrations` and skipped on subsequent boots.
 */
export async function runMigrations(migrationsFolder: string): Promise<void> {
  await migrate(drizzle(tursoClient), { migrationsFolder })
}
