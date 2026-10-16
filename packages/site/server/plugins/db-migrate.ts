import { runMigrations } from '#layers/BaseDB/server/utils/run-migrations'

const MIGRATION_RETRY = { attempts: 15, delayMs: 2000 } as const

/**
 * Docker-only, and never during prerender: the build runs `pnpm site`, where
 * NUXT_TURSO_DATABASE_URL is unset and would migrate a throwaway `local.db`.
 */
function bootMigrationsEnabled(): boolean {
  return process.env.DB_MIGRATE_ON_BOOT === '1' && !import.meta.prerender
}

export default defineNitroPlugin(async () => {
  if (!bootMigrationsEnabled()) return

  const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_DIR
  if (!migrationsFolder) {
    throw new Error('[db-migrate] DRIZZLE_MIGRATIONS_DIR is required when DB_MIGRATE_ON_BOOT=1')
  }

  await runMigrationsWithRetry(migrationsFolder)
})

async function runMigrationsWithRetry(migrationsFolder: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MIGRATION_RETRY.attempts; attempt++) {
    try {
      await runMigrations(migrationsFolder)
      log.info({ message: `[db-migrate] migrations applied from ${migrationsFolder}` })
      return
    }
    catch (error) {
      lastError = error
      log.warn({ message: `[db-migrate] attempt ${attempt}/${MIGRATION_RETRY.attempts} failed`, error: String(error) })
      if (attempt < MIGRATION_RETRY.attempts) {
        await new Promise(resolve => setTimeout(resolve, MIGRATION_RETRY.delayMs))
      }
    }
  }
  throw new Error(`[db-migrate] migrations failed after ${MIGRATION_RETRY.attempts} attempts: ${String(lastError)}`)
}
