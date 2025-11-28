import { migrate } from 'drizzle-orm/libsql/migrator'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

async function migrateDatabase() {
  const db = useDrizzle()
  await migrate(db, { migrationsFolder: "../db/db/migrations/" })
}

export default defineNitroPlugin(async (nitroApp) => {

  console.log("<<<---- START MIGRATION")
  const db = await migrateDatabase()
  console.log("END MIGRATION ---->>>")

})
