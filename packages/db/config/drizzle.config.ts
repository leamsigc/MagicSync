import { defineConfig } from 'drizzle-kit'
import { tursoConfig } from './turso.config'
console.log(tursoConfig);

export default defineConfig({
  dialect: 'turso',
  schema: './db/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: tursoConfig.url,
    authToken: tursoConfig.authToken
  },
  verbose: true,
  strict: true
})
