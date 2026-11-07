# Object cheatsheet

Use only these fabric types. IDs must be unique and stable.

## Common keys

| Key | Type | Notes |
|---|---|---|
| `id` | string | Required, unique, e.g. `headline` |
| `type` | string | Required fabric type |
| `left` | number | X position; default 0 |
| `top` | number | Y position; default 0 |
| `originX` | `"left"` | Keep left for predictable coordinates |
| `originY` | `"top"` | Keep top for predictable coordinates |
| `angle` | number | Degrees |
| `opacity` | 0–1 | 1 = opaque |
| `visible` | boolean | `false` hides the layer |
| `selectable` | boolean | Background images often `false` |
| `evented` | boolean | Background images often `false` |
| `name` | string | `{field}` or `{field:suffix}` for variables |

## Textbox

Required: `text`, `width`, `fontSize`, `fontFamily`, `fill`.

| Key | Example | Notes |
|---|---|---|
| `text` | `"Spring\nSale"` | `\n` is a hard line break |
| `width` | `920` | Wrapping width |
| `fontSize` | `116` | px |
| `fontFamily` | `"Archivo Black"` | Prefer a bundled family |
| `fontWeight` | `"bold"` | `"normal"` or `"bold"` |
| `fontStyle` | `"italic"` | Optional |
| `fill` | `"#ffffff"` | Text colour |
| `textAlign` | `"left"` | `left`, `center`, `right`, `justify` |
| `lineHeight` | `1.02` | Multiplier |
| `charSpacing` | `0` | 0 = normal |
| `underline` | `false` | Optional |
| `shadow` | `{ "color": "#000", "blur": 8, "offsetX": 0, "offsetY": 4 }` | Optional |

Do not set `height`; let fabric measure the wrapped text.

## Image

Required: `src`, `width`, `height`.

| Key | Notes |
|---|---|
| `src` | `https://`, `data:image/…`, or `/api/v1/image-editor/assets/…` |
| `crossOrigin` | `"anonymous"` for remote images |
| `scaleX` / `scaleY` | Optional non-destructive scale |

## Rect

Required: `width`, `height`, `fill`.

Optional: `rx`, `ry`, `stroke`, `strokeWidth`.

## Circle

Required: `radius`, `fill`. Optional: `stroke`, `strokeWidth`.

`left`/`top` refer to the left/top of the bounding box, so the centre is
`left + radius`, `top + radius`.

## Triangle

Required: `width`, `height`, `fill`.

## Path / polygon / line

- `path`: fabric path array or SVG path string plus `fill`.
- `polygon`: `points: [{ x, y }, …]` plus `fill`.
- `line`: `x1`, `y1`, `x2`, `y2`, `stroke`, `strokeWidth`.

Prefer rects/circles/text for generated templates; complex paths are harder to
edit and easier to break.

## Group

```json
{
  "id": "cta-group",
  "type": "group",
  "left": 0,
  "top": 0,
  "objects": [ ]
}
```

Groups are supported but keep them shallow. Absolute child coordinates are
relative to the group transform in fabric; for generated templates it is safer
to avoid groups and use flat layers.

## Fonts

Bundled: Archivo Black, Anton, Bebas Neue, Lobster, Pacifico, Abril Fatface,
Righteous, Alfa Slab One, DejaVu Sans, ZCOOL KuaiLe, ZCOOL QingKe HuangYou,
Ma Shan Zheng, Noto Sans SC.

Generic fallbacks: Arial, Helvetica, Georgia, Times New Roman, Verdana,
sans-serif, serif, system-ui.

Other Google fonts may be downloaded at render time. Use at most one display
font and one body font.

## Layer order

1. `__background` image or page fill
2. photos / image layers
3. overlay rects and shapes
4. text
5. CTAs, badges, borders

## Field patterns

| Pattern | Meaning |
|---|---|
| `{headline}` | Text field named `headline` |
| `{photo}` on an image | Image field named `photo` |
| `{photo:image_url}` | Explicit image field |
| `{accent:color}` | Colour field |
| `{title:font_size}` | Font-size field |
| `{logo:visible}` | Visibility field |

Also declare the field:

```json
{ "name": "headline", "targets": [{ "objectId": "headline", "property": "text" }] }
```
