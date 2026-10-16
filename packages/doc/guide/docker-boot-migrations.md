# Migrations on Docker boot

## What changed

The container now applies pending Drizzle migrations to the libSQL database on
startup, so a fresh deploy (or a reset database) no longer needs a manual
`pnpm db:migrate` from the host. `docker-setup.md` already claimed "first boot
runs migrations" — this makes that true.

- `packages/db/server/utils/run-migrations.ts` — `runMigrations(folder)` wraps
  `drizzle-orm/libsql/migrator` using the shared `tursoClient`.
- `packages/site/server/plugins/db-migrate.ts` — Nitro startup plugin, gated by
  `DB_MIGRATE_ON_BOOT=1`, with a bounded retry and **fail-fast** on error.
- `Dockerfile` (runtime stage) — copies `packages/db/db/migrations` to
  `.output/migrations` and sets `DRIZZLE_MIGRATIONS_DIR`.
- `docker-compose.yml` — sets `DB_MIGRATE_ON_BOOT=1` on the `site` service.

## Why gated + fail-fast

- **Gated on `DB_MIGRATE_ON_BOOT=1`.** The Docker build runs `pnpm site` which
  boots Nitro for prerender; at that point `NUXT_TURSO_DATABASE_URL` is unset and
  the config falls back to `file:../../local.db`. Without the gate the build
  would migrate a throwaway file. `import.meta.prerender` is a second guard.
- **Retry (15 × 2s).** The compose `db` service has no healthcheck, so a fresh
  boot can race the database.
- **Fail-fast.** A migration failure throws, Nitro startup fails, the container
  exits, and `restart: unless-stopped` loops with the error in
  `docker compose logs site`. A half-migrated schema is never served.

## How it works

Node (`node .output/server/index.mjs`) resolves `drizzle-orm` from
`.output/server/node_modules`; the plugin is bundled by Nitro, so the HTTP
libSQL client works at boot. `migrate()` is idempotent — applied migrations are
recorded in `__drizzle_migrations` and skipped on the next boot.

## Gotchas

- Single `site` replica assumption. Multiple replicas would race the migrator and
  need the one-shot `migrate` service variant instead.
- The published image (`ghcr.io/leamsigc/magicsync`) needs a rebuild for the
  Dockerfile `COPY` to take effect.
- `DB_MIGRATE_ON_BOOT` in a host `.env` also makes `pnpm site:dev` migrate on
  boot against `NUXT_TURSO_DATABASE_URL`; it is left commented in `.env-example`.

## Verify

```bash
docker compose up -d --build
docker compose logs -f site        # "[db-migrate] migrations applied from ..."
docker compose restart site        # second boot: no-op
# break it: DRIZZLE_MIGRATIONS_DIR=/nope -> container exits with the error
```
