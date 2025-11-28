import { migrate } from 'drizzle-orm/libsql/migrator'
import { useDrizzle } from '../server/utils/drizzle'
import config from '../config/drizzle.config';


const db = useDrizzle()

await migrate(db, { migrationsFolder: config.out! })
