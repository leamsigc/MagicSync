# i18n Audit

`pnpm audit:i18n` (script: `scripts/i18n-audit.mjs`) checks every translation
file for locale parity: each file with ≥2 locale codes as top-level keys gets
flattened per locale, and any key present in one locale but missing in another
is reported, along with empty-string values (usually untranslated copy-paste).

## What it catches

- Missing keys: a German user sees a raw key or English fallback (e.g. the
  entire `feeds.tabs` / `postComments` / `postStats` blocks once absent from
  es/fr/de).
- Shape drift: `preview_modal.title` existing only in fr, or `{title,
  description}` vs `{tools}` objects in the same file across locales.
- Empty strings: `csvImport.step2.actions` was `""` in all four locales —
  the table header rendered blank everywhere.

## Fix policy

- Key used somewhere → translate it into the missing locales.
- Key used nowhere (verified with `rg` for the literal path, which also catches
  dynamic `t(\`a.${x}\`)` construction) → delete it from the locales that have
  it. Never invent English copy for a dead key.
- Arrays expand to indexed paths, so list-length drift between locales shows
  up as missing indices.

## Usage

```bash
pnpm audit:i18n                    # whole repo, exit 1 on gaps
node scripts/i18n-audit.mjs --json # machine-readable
node scripts/i18n-audit.mjs --files packages/site/app/pages/app/posts/feeds/feeds.json
```
