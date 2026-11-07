# Reference-image design brief

Use this checklist when the user supplies an image, screenshot, ad, or moodboard.

## 1. Frame

- Aspect ratio: 1:1, 4:5, 9:16, 16:9, 1.91:1.
- Pick the nearest studio preset; do not use an arbitrary size unless requested.
- Note whether the reference is a full-bleed photo, split layout, or type-led.

## 2. Palette

- Extract 3–5 dominant colours as hex values.
- Identify the background, primary text, accent, and CTA colours.
- Check contrast; do not copy an unreadable pairing literally.

## 3. Typography

- Display/heading family category: geometric sans, grotesk, serif, slab, script, condensed.
- Body family category.
- Weight contrast (bold headline + regular body).
- Casing (uppercase eyebrow, sentence-case body).
- Alignment (left, centered) and line count.
- Approximate with a bundled font; do not invent a font name that is not in the manifest.

## 4. Layout

- Grid: single column, split, 2-column, card, full-bleed.
- Margins and safe area.
- Image treatment: cover, contain, cutout, duotone, overlay.
- Decorative elements: rules, circles, badges, borders, gradients, grain.
- CTA shape: pill, rectangle, underline, text-only.

## 5. Hierarchy

Write the order in which the eye should read:

1. headline
2. supporting line
3. offer/price/date
4. CTA
5. fine print

If the reference has more than four text blocks, keep three and merge the rest.

## 6. Editable mapping

| Reference element | Template layer | Field |
|---|---|---|
| Main headline | textbox | `headline` |
| Supporting sentence | textbox | `body` |
| Button label | textbox inside rect | `cta` |
| Price / discount | textbox | `price` or `discount` |
| Date / time | textbox | `date` |
| Main photo | image | `photo` |
| Logo | image | `logo` |
| Accent colour | rect fill | `accent` (color field) |

## 7. Approximation rules

- Recreate the layout, not the exact pixels.
- Use editable text and shapes; never flatten the whole reference into one image.
- A reference photo may be used only if the user supplied it or approved a stock
  replacement.
- If the reference contains branded fonts/assets you cannot use, substitute and
  say so.
- If the reference is too low-resolution to read, ask for a better image or a
  written direction.

## 8. Output spec

Before writing JSON, state the spec in one short block:

```
Frame: 1080x1350
Palette: #0f172a / #f8fafc / #22d3ee / #fb923c
Type: Archivo Black 116 / Arial 38
Layout: photo-led, dark overlay, left type, CTA pill bottom-left
Fields: headline, body, cta, photo
```
