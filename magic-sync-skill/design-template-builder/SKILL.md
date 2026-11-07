---
name: design-template-builder
description: Create MagicSync image-editor design templates (magicsync/image-editor@1 JSON) from a reference image, product photo, or written direction. Use when asked to create a design template, social media template, image-editor JSON, convert a reference into an editable template, or import/publish templates to the shared library.
argument-hint: "<reference image | image URL | design direction>"
version: 1.0.0
allowed-tools:
  - Bash
  - Read
  - Write
triggers:
  - create design template
  - image editor template
  - design json
  - template from image
  - template from reference
  - social media template
  - instagram template
  - story template
  - carousel template
  - product template
  - magic sync template
  - import template
  - design template json
---

# Design Template Builder

Build editable `magicsync/image-editor@1` documents for `/tools/image-editor`.
The same JSON powers the browser editor, server renders, batch generation, MCP
`render-design`, and the shared public template library.

## When to use this skill

Use it when the user wants any of these:

- “Make me a template for Instagram / stories / a sale / a quote / an event.”
- “Recreate this reference image as an editable design.”
- “Turn this product photo + copy into a template.”
- “Give me the JSON for the MagicSync image editor.”
- “Import this template so other users can see it in the UI.”

For a pure chat workflow, point the user at `MASTER_PROMPT.md` in this folder.
It is a copy-paste prompt for ChatGPT/Claude that returns the same JSON format.

## Inputs

| Input | What to do |
|---|---|
| Reference image | Read it, then extract ratio, palette, typography, layout, hierarchy and image treatment. Approximate it with editable layers; do not return a flattened screenshot unless the user explicitly asks for one. |
| Product/background photo | Place it as an `image` layer. Small files can be inlined with `image-to-data-url.mjs`; larger ones should be a public `https://` URL. |
| Written direction | Build from a layout recipe in `references/layout-recipes.md`. |
| Brand kit | Apply its colours and font pair before choosing new ones. |
| Existing template | Fetch the document, then adapt frame, palette, type and copy. |

If no image is supplied, use solid colours, shapes and typography. **Never
invent an image URL.** Use the user’s image, a stock result the user approved,
or a colour/shape-only composition.

## Non-negotiables

1. **Schema** — `"schema": "magicsync/image-editor@1"`, `frame`, `fields`, `pages`.
2. **Fabric types only** — `textbox`, `rect`, `circle`, `triangle`, `path`, `polygon`, `image`, `group`, `line`. Never output `figure` or `svg`; use `image` for SVG data URLs.
3. **Unique IDs** — stable, readable, unique across the document (`headline`, `body`, `cta-bg`, `photo`).
4. **Fields** — replaceable content uses `{name}` layer names **and** an explicit `fields[]` entry. Field names are `[A-Za-z0-9_]+`.
5. **Safe area** — keep text and key elements at least 5–7% from the edges.
6. **Readable contrast** — body text ≥ 4.5:1, large display text ≥ 3:1.
7. **No comments, trailing commas, `undefined`, `NaN`, or computed expressions** in the JSON.
8. **Do not publish publicly without explicit confirmation.**

## Workflow

### 1. Clarify the brief

Collect or infer:

- canvas size / platform;
- headline, body, CTA, price/date, and any other copy;
- brand colours and fonts;
- optional reference/product image;
- variables the user wants to fill later;
- public template or private design.

If the user gives a reference image, write a short design spec first:

```
Frame: 1080x1350
Palette: #0f172a, #f8fafc, #22d3ee, #fb923c
Type: Archivo Black headline / Arial body
Layout: full-bleed photo, dark overlay, left-aligned type, CTA pill bottom-left
Fields: headline, body, cta, photo
```

### 2. Start from a valid skeleton

```bash
node scripts/new-template.mjs \
  --size portrait \
  --title "Spring sale" \
  --out /tmp/spring-sale.json
```

Sizes: `square` 1080×1080, `portrait` 1080×1350, `story` 1080×1920,
`landscape` 1920×1080, `link` 1200×628, `youtube` 1280×720, or `WxH`.

Use `--blank` to start with no starter text. Edit the JSON with the Write tool.

### 3. Compose the document

Read `references/document-format.md` and `references/object-cheatsheet.md`
before composing. Use `references/layout-recipes.md` for coordinates.

Layer order is back-to-front:

1. page `background.fill` or full-bleed image with `"id": "__background"`;
2. photo/image layers;
3. overlay rectangles and decorative shapes;
4. text layers;
5. buttons/badges on top.

For a full-bleed photo:

```json
{
  "id": "__background",
  "type": "image",
  "src": "https://example.com/photo.jpg",
  "left": 0,
  "top": 0,
  "width": 1080,
  "height": 1350,
  "originX": "left",
  "originY": "top",
  "selectable": false,
  "evented": false,
  "crossOrigin": "anonymous"
}
```

For text, always set `width` (wrapping), `fontSize`, `fontFamily`, `fill`,
`lineHeight`, and `originX`/`originY` as `left`/`top`.

For editable text, use the field name in the layer:

```json
{
  "id": "headline",
  "type": "textbox",
  "name": "{headline}",
  "text": "Your headline",
  "left": 76,
  "top": 180,
  "width": 928,
  "fontSize": 116,
  "fontFamily": "Archivo Black",
  "fontWeight": "bold",
  "fill": "#ffffff",
  "lineHeight": 1.02
}
```

and declare it:

```json
{ "name": "headline", "targets": [{ "objectId": "headline", "property": "text" }] }
```

Image fields use `{photo}` on the image layer and `property: "image_url"`.

### 4. Validate

```bash
node scripts/validate-template.mjs /tmp/spring-sale.json
```

This checks schema, frame, object types, unique IDs, field names/targets,
image sources, text bounds, contrast warnings, fonts and the 4 MB import limit.
Fix errors before rendering. Warnings are allowed but report them.

### 5. Render a preview

```bash
MAGICSYNC_API_TOKEN=org_... \
  node scripts/render-preview.mjs /tmp/spring-sale.json \
  --out /tmp/spring-sale.png --scale 0.5
```

Local logged-in session alternative:

```bash
MAGICSYNC_COOKIE='better-auth.session_token=...' \
  node scripts/render-preview.mjs /tmp/spring-sale.json --out /tmp/spring-sale.png
```

Read the PNG and check:

- text is not clipped or overflowing;
- headline hierarchy is obvious at thumbnail size;
- contrast passes over the background;
- margins are balanced;
- image crop keeps the subject visible;
- no layer is hidden or outside the frame.

Iterate up to 3 times. Report remaining warnings instead of hiding them.

### 6. Deliver

**JSON only** — leave the file in `/tmp` or the user’s chosen folder and show
the key fields.

**Private design (API):**

```bash
MAGICSYNC_API_TOKEN=org_... \
  node scripts/import-template.mjs /tmp/spring-sale.json \
  --mode api --title "Spring sale"
```

**Public template (API, explicit confirmation):**

```bash
MAGICSYNC_API_TOKEN=org_... \
  node scripts/import-template.mjs /tmp/spring-sale.json \
  --mode api --title "Spring sale" --public
```

**Admin bulk import (file mode, publishes via seeder):**

```bash
node scripts/import-template.mjs /tmp/spring-sale.json \
  --id seed-design-spring-sale --title "Spring sale"
pnpm design:seed
```

File mode writes `packages/db/scripts/import-templates/<id>.json`. The seeder
forces `isPublic = 1`, so the template appears in `/tools/image-editor` →
Templates for guests and signed-in users.

**MCP path (when the MagicSync MCP server is connected):**

- `render-design` — render an inline `template`/`document` and inspect the asset URL.
- `create-design` — import raw JSON or duplicate a template.
- `publish-design-template` — publish/unpublish a design you own.
- `list-design-templates` / `get-design-template` / `list-design-variables` — inspect the library.

## Image rules

| Source | Allowed | Notes |
|---|---|---|
| `https://…` | Yes | Import caches remote images into design assets; keep the URL public while importing. |
| `data:image/...;base64,...` | Yes | Good for small local images; keep the design under 4 MB. |
| `/api/v1/image-editor/assets/...` | Yes | Design-asset store path, readable without auth. |
| `http://…` | No | Rejected by the validator; use HTTPS. |
| guessed/placeholder URL | No | Never invent a URL. Use colour/shapes or ask for an asset. |

For a full-bleed photo, request an image already cropped to the frame size
(for example Unsplash `?w=1080&h=1350&fit=crop`) or set `scaleX`/`scaleY` to
fill. `width`/`height` alone may not cover the frame.

Convert a local image with:

```bash
node scripts/image-to-data-url.mjs photo.jpg --max-mb 2 --out /tmp/photo.dataurl
```

## Fonts

Prefer bundled families: Archivo Black, Anton, Bebas Neue, Lobster, Pacifico,
Abril Fatface, Righteous, Alfa Slab One, DejaVu Sans, ZCOOL KuaiLe,
ZCOOL QingKe HuangYou, Ma Shan Zheng, Noto Sans SC.

Other Google fonts may work at render time, but the validator warns: the
editor/renderer has to download them, which can lag or fall back. Use one
display font + one body font maximum.

## Sizes and safe margins

| Preset | Size | Typical use |
|---|---|---|
| `square` | 1080×1080 | Feed post |
| `portrait` | 1080×1350 | 4:5 feed post |
| `story` | 1080×1920 | Story / Reel cover |
| `landscape` | 1920×1080 | YouTube / wide banner |
| `link` | 1200×628 | Link preview |
| `youtube` | 1280×720 | Thumbnail |

Margin guide: 64–96 px on a 1080-wide canvas (≈7%).

## File map

| Path | Purpose |
|---|---|
| `SKILL.md` | This workflow |
| `MASTER_PROMPT.md` | Copy-paste prompt for ChatGPT/Claude chat |
| `scripts/new-template.mjs` | Scaffold a valid document |
| `scripts/validate-template.mjs` | Structural validator |
| `scripts/render-preview.mjs` | Server render + PNG preview |
| `scripts/import-template.mjs` | Admin file import or API create |
| `scripts/image-to-data-url.mjs` | Local image → data URL |
| `references/document-format.md` | Envelope + object contract |
| `references/object-cheatsheet.md` | Object property reference |
| `references/layout-recipes.md` | Coordinates for common layouts |
| `references/design-brief.md` | Reference-image analysis checklist |
| `references/import-and-publish.md` | Admin/API/MCP publishing paths |
| `examples/` | Ready-to-render documents |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `schema must be …` | Wrap the document in the envelope; do not send a bare `pages` array. |
| `targets missing object` | The field’s `objectId` must match a layer `id`. |
| Text is clipped | Increase `width`, reduce `fontSize`, or move the layer inside the frame. |
| Text is invisible | Check `fill`, `visible: false`, and layer order. |
| Image is blank in server render | Use `https://`, a data URL, or `/api/v1/image-editor/assets/…`; `http://` and relative app URLs are rejected. |
| Font falls back | Use a bundled family; other Google fonts may not be available to the renderer. |
| “second row overlays the first” | Do not reuse duplicate object IDs; the binder updates every object sharing an id. |
| Import says 4 MB | Reduce image data URLs or use remote URLs. |

## Verification checklist

- [ ] Validator exits 0.
- [ ] Preview PNG looks correct at full size and thumbnail size.
- [ ] All fields have targets and matching layer names.
- [ ] No duplicate IDs.
- [ ] No invented image URLs.
- [ ] Public publishing was explicitly confirmed.
- [ ] For admin import: `pnpm design:seed` completed and the template appears in the UI.
