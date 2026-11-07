# Design Template Builder

Create editable MagicSync image-editor templates from a reference image,
product photo, or written direction.

- **Agents:** read `SKILL.md` for the full workflow.
- **ChatGPT / Claude chat:** copy the prompt from `MASTER_PROMPT.md`, then append
  your brief and optional reference image.
- **Examples:** `examples/*.json` are valid starting points.
- **Validator:** `node scripts/validate-template.mjs <file>`
- **Preview:** `MAGICSYNC_API_TOKEN=org_… node scripts/render-preview.mjs <file>`
- **Import:** `node scripts/import-template.mjs <file> --id seed-design-my-template --title "My template"` then `pnpm design:seed`
- **Public API import:** add `--mode api --public`

The folder is self-contained and does not require the social-posting skill.
