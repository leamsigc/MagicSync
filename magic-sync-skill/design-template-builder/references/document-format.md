# Image-editor document format

A design is a single JSON object with schema `magicsync/image-editor@1`.

```json
{
  "schema": "magicsync/image-editor@1",
  "version": 1,
  "frame": { "width": 1080, "height": 1350, "fill": "#0f172a" },
  "fields": [
    { "name": "headline", "targets": [{ "objectId": "headline", "property": "text" }] }
  ],
  "meta": { "title": "Spring sale", "category": "social", "tags": ["template"] },
  "pages": [
    {
      "id": "page-1",
      "name": "Page 1",
      "duration": 4000,
      "objects": [],
      "background": { "fill": "#0f172a" },
      "animation": { "layers": {} }
    }
  ]
}
```

## Top-level keys

| Key | Required | Notes |
|---|---|---|
| `schema` | Yes | Must be exactly `magicsync/image-editor@1` |
| `version` | Recommended | `1` |
| `frame` | Yes | `{ width, height, fill }`, 10–8192 px each |
| `fields` | Yes | `[]` when there are no variables |
| `meta` | Optional | `title`, `category`, `tags`, `sort`, `price` |
| `pages` | Yes | At least one page |

## Page

| Key | Notes |
|---|---|
| `id` | Stable, e.g. `page-1` |
| `name` | Human label |
| `duration` | MP4 duration in ms (default 4000) |
| `objects` | Back-to-front layer array |
| `background.fill` | Page fill colour |
| `animation.layers` | Usually `{}`; per-layer enter/exit/loop animations |
| `audio` | Optional `{ url, name, volume }` for MP4 export |

## Fields

A field maps a variable name to one or more layer properties.

```json
{ "name": "headline", "targets": [{ "objectId": "headline", "property": "text" }] }
```

Field names are `[A-Za-z0-9_]+`, unique, and must not contain `__`.

| Property | Use |
|---|---|
| `text` | Textbox content |
| `image_url` | Image `src` |
| `video_url` | Video layer source |
| `color` | Layer `fill` |
| `font_family` | `fontFamily` |
| `font_size` | `fontSize` |
| `visible` | `visible` boolean |

Also name the layer `{headline}` (or `{photo:image_url}`) so the editor and
importers can rebuild the same field. For image fields, `{photo}` infers
`image_url` from the image type.

## Objects

Every object needs a unique `id` and a fabric `type`.

- `textbox` — text, width, fontSize, fontFamily, fill
- `image` — src, width, height
- `rect` — width, height, fill, optional rx/ry
- `circle` — radius, fill
- `triangle` — width, height, fill
- `path` — path array/string, fill
- `polygon` — points, fill
- `line` — coordinates, stroke
- `group` — nested `objects[]`

Common properties: `left`, `top`, `originX: "left"`, `originY: "top"`,
`angle`, `opacity`, `visible`, `selectable`, `evented`.

### Textbox

```json
{
  "id": "headline",
  "type": "textbox",
  "name": "{headline}",
  "left": 76,
  "top": 180,
  "width": 928,
  "text": "Your headline",
  "fontSize": 116,
  "fontFamily": "Archivo Black",
  "fontWeight": "bold",
  "fontStyle": "normal",
  "fill": "#ffffff",
  "textAlign": "left",
  "lineHeight": 1.02,
  "charSpacing": 0,
  "originX": "left",
  "originY": "top"
}
```

`width` is required for wrapping. Do not set a fixed `height`; fabric measures
the text. Long copy should be shortened rather than shrunk below readable size.

### Image

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

Full-bleed page photos use the id `__background` and must be first. The renderer
also moves it first defensively, but keeping the JSON correct avoids surprises.
If the source image is not already the frame size, request a cropped URL (e.g.
Unsplash `?w=1080&h=1350&fit=crop`) or set `scaleX`/`scaleY` to fill; `width`
and `height` alone may not cover the frame.

### Rect / circle

```json
{ "id": "cta-bg", "type": "rect", "left": 76, "top": 1120, "width": 360, "height": 92, "rx": 46, "ry": 46, "fill": "#22d3ee" }
```

```json
{ "id": "badge", "type": "circle", "left": 790, "top": 120, "radius": 120, "fill": "#fb923c" }
```

## Image sources

Accepted:

- `https://…`
- `data:image/…;base64,…`
- `/api/v1/image-editor/assets/…`

Rejected by the validator:

- `http://…`
- relative app URLs such as `/api/v1/assets/serve/…`
- invented or placeholder URLs

## Import wrappers

The editor and render APIs take the raw document above.

The admin seeder and import folder take:

```json
{ "id": "seed-design-spring", "title": "Spring sale", "document": { } }
```

Designs stored in the database use an envelope:

```json
{ "schema": "magicsync/image-editor@1", "doc": { }, "meta": { }, "savedAt": "…" }
```

The scripts accept any of these wrappers and unwrap them.
