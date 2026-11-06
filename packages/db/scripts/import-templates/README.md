# Local template imports (git-ignored)

Put template JSON files here when you want to publish them to every user
without committing them to the repository.

1. Each file must export `{ "id", "title", "document" }` — the same shape the
   converter writes. Convert a Polotno Studio export first:

   ```bash
   node packages/tools/scripts/convert-polotno-template.mjs \
     ~/Downloads/my-design.json \
     packages/db/scripts/import-templates/my-design.json \
     seed-design-my-design \
     "My Design"
   ```

2. Import everything (this also re-seeds the built-in catalog):

   ```bash
   pnpm design:seed
   ```

3. The imported rows are public (`isPublic = 1`) and appear in the studio's
   Template library for guests and signed-in users.

Everything except this README and `.gitignore` is ignored by git.
