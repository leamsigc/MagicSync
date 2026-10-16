---
name: i18n-audit
description: Check locale parity across every translation JSON (en/es/de/fr) — finds keys missing in any locale, shape drift between locales, and empty-string values. Use when a user reports untranslated UI or raw keys in a non-English locale, when adding keys to any locale file, or as a pre-merge check via pnpm audit:i18n.
---

# i18n audit

## When to use
A non-English locale shows raw keys, English fallback text, or blank labels.
Or you just edited a locale JSON and want proof all four locales still match.

## Steps
1. Run the audit:
   ```bash
   pnpm audit:i18n
   ```
   Scoped to files you touched:
   ```bash
   node scripts/i18n-audit.mjs --files path/to/a.json,path/to/b.json
   ```
2. Read each gap. Two kinds:
   - **Missing key** (one locale lacks what others have) → translate it there.
     Source of truth is the `en` block; keep `{placeholders}` intact.
   - **Shape drift** (`preview_modal.title` in fr only, `{title,description}`
     vs `{tools}`) → first check usage: `rg -n 'the.key.path' packages --glob '*.vue'`
     catches even dynamic `` t(`a.${x}`) `` construction. Used → translate.
     Unused → delete from the locales that have it; never invent copy.
3. **Empty strings** (`""` in any locale) → fill with real copy in all four.
4. Re-run until exit 0: `pnpm audit:i18n`.

## Gotchas
- The script only sees files tracked by git with ≥2 locale codes as top-level
  keys; `package.json`/`tsconfig`/public assets are excluded automatically.
- Values identical to English (e.g. `"description": "Posts"` in es) are NOT
  flagged — presence is checked, translation quality is a human review.
- `<i18n src>` blocks are component-scoped: a key must exist in the JSON of
  the component that calls `t()`, not just somewhere in the repo.
