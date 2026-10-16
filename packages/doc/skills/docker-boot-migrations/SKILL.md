---
name: docker-boot-migrations
description: Run Drizzle migrations automatically when a Docker/Nitro container starts, gated by an env flag and failing fast so a half-migrated schema is never served. Use when asked "run migrations on docker start", "auto-migrate on boot", "first boot migrations", or when a self-hosted deploy needs migrations without a manual host step.
---

# Migrations on container boot (Nitro plugin)

## When to use
A self-hosted/Docker deploy needs `db:migrate` to run automatically at startup
instead of a manual host step.

## Steps
1. **Ship the migrations into the image.** Nitro does not trace plain SQL, so
   copy them explicitly in the runtime stage and point an env var at them:
   ```dockerfile
   COPY --from=builder /usr/app/packages/db/db/migrations /usr/app/.output/migrations
   ENV DRIZZLE_MIGRATIONS_DIR=/usr/app/.output/migrations
   ```
2. **Add a runner** in the db layer (`packages/db/server/utils/run-migrations.ts`)
   using the shared `tursoClient`:
   ```ts
   import { drizzle } from 'drizzle-orm/libsql'
   import { migrate } from 'drizzle-orm/libsql/migrator'
   import { tursoClient } from './drizzle'
   export async function runMigrations(migrationsFolder: string): Promise<void> {
     await migrate(drizzle(tursoClient), { migrationsFolder })
   }
   ```
3. **Add a Nitro startup plugin** in the deploy root
   (`packages/site/server/plugins/db-migrate.ts`):
   - return unless `process.env.DB_MIGRATE_ON_BOOT === '1'`
   - return if `import.meta.prerender` (belt: the Docker build prerenders Nitro
     with the DB URL unset, which would migrate a throwaway `local.db`)
   - require `DRIZZLE_MIGRATIONS_DIR` (throw a clear error if missing)
   - retry a bounded number of times (the `db` service usually has no
     healthcheck), then **throw** → container exits unhealthy, logs show the
     error, `restart: unless-stopped` loops.
4. **Set the flag in compose only**, not in the Dockerfile:
   `site.environment: - DB_MIGRATE_ON_BOOT=1`.

## Gotchas
- **Single replica.** Multiple replicas race the migrator; use a one-shot
  `migrate` compose service (`depends_on: { db: { condition: service_healthy } }`
  + `site.depends_on.migrate: service_completed_successfully`) instead.
- The published image must be rebuilt for the Dockerfile `COPY` to take effect.
- A host `.env` with `DB_MIGRATE_ON_BOOT=1` also makes `pnpm site:dev` migrate on
  boot — leave it commented in `.env-example`.
- Keep every new/changed function ≤ 5 branches; extract the retry loop into its
  own function.

## Verify
```bash
docker compose up -d --build
docker compose logs -f site        # "[db-migrate] migrations applied from ..."
docker compose restart site        # no-op on second boot
# point DRIZZLE_MIGRATIONS_DIR at a missing path -> container exits with the error
```
