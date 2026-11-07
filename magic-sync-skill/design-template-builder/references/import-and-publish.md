# Import and publish

## Where templates live

| Path | Purpose |
|---|---|
| `packages/db/scripts/seed-design-templates.mjs` | Built-in catalog (inline `TEMPLATES` array) |
| `packages/db/scripts/seed-templates/*.json` | Versioned extra templates committed to git |
| `packages/db/scripts/import-templates/*.json` | Git-ignored admin drop folder |
| `/app/admin/data/templates` | Generic admin table browser |
| `/app/admin/design-assets` | Rendered design assets (not templates) |

## File shape

```json
{
  "id": "seed-design-spring",
  "title": "Spring sale",
  "document": { "schema": "magicsync/image-editor@1", "…": "…" }
}
```

## Admin bulk import (publishes to everyone)

```bash
node magic-sync-skill/design-template-builder/scripts/import-template.mjs \
  /tmp/spring.json --id seed-design-spring --title "Spring sale"

pnpm design:seed
```

File mode writes to `packages/db/scripts/import-templates/<id>.json`. The seeder:

- reads `seed-templates/` and `import-templates/`;
- `insert or replace` by `id`;
- forces `isPublic = 1`;
- regenerates the SVG thumbnail;
- makes the template visible in `/tools/image-editor` → Templates for guests and
  signed-in users.

Use a unique `id`; rerunning with the same id overwrites the row.

## API: private design

```bash
MAGICSYNC_API_TOKEN=org_... \
  node magic-sync-skill/design-template-builder/scripts/import-template.mjs \
  /tmp/spring.json --mode api --title "Spring sale"
```

This calls `POST /api/v1/image-editor/designs`. The design is private until
published from **My Designs**.

## API: public template

```bash
MAGICSYNC_API_TOKEN=org_... \
  node magic-sync-skill/design-template-builder/scripts/import-template.mjs \
  /tmp/spring.json --mode api --title "Spring sale" --public
```

This creates the design with `isPublic: true`, so it appears in the public
template library immediately.

## Publish an existing design

```bash
curl -X PUT "$MAGICSYNC_BASE_URL/api/v1/image-editor/designs/<id>/publish" \
  -H "Authorization: Bearer $MAGICSYNC_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{"isPublic":true}'
```

## MCP tools

When the MagicSync MCP server is connected:

| Tool | Use |
|---|---|
| `render-design` | Render inline `template`/`document` to a signed asset |
| `create-design` | Import raw JSON, duplicate a template, or create blank |
| `publish-design-template` | Publish/unpublish a design you own |
| `list-design-templates` | Browse public templates + own designs |
| `get-design-template` | Fetch a full document + fields |
| `list-design-variables` | List fields available for fills |
| `batch-generate-designs` | One image per row |

## Authentication notes

- Design HTTP routes accept `Authorization: Bearer org_…` or a logged-in session
  cookie.
- `X-Api-Key` is for `/api/v1/cli` endpoints, not the design routes.
- MCP uses its own `Authorization: Bearer org_…` connection.
- A local preview can use `MAGICSYNC_COOKIE` instead of an API key.

## Visibility model

- `isPublic = 0` → only the owner sees the design in **My Designs**.
- `isPublic = 1` → appears in **Templates** for everyone, including guests.
- The admin seeder always publishes (`isPublic = 1`).
- Publishing is reversible with `publish-design-template` or the publish route.

## After importing

1. Open `/tools/image-editor`.
2. Check **Templates** (public) or **My Designs** (private).
3. Render once to confirm the thumbnail and document load.
4. If the template has fields, try a batch row to confirm variable binding.
