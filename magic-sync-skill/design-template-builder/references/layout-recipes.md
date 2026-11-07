# Layout recipes

Coordinates assume `originX: "left"`, `originY: "top"` and a margin of roughly
7% of the shorter side.

- 1080×1080 → margin 76
- 1080×1350 → margin 76
- 1080×1920 → margin 76
- 1200×628 → margin 56

## Photo-led feed post (1080×1080)

```text
__background  0,0 1080×1080 (photo)
overlay       0,0 1080×1080 fill #0f172a opacity 0.45
eyebrow       76,120 width 600, fontSize 30, fill #22d3ee
headline      76,180 width 900, fontSize 118, fill #ffffff
body          76,600 width 760, fontSize 38, fill #e2e8f0
cta-bg        76,820 width 340 height 88 rx 44 fill #22d3ee
cta           76,844 width 340, fontSize 30, align center, fill #0f172a
```

## Split layout (1080×1350)

```text
background    0,0 1080×1350 fill #f8fafc
photo         540,0 540×900 (image)
headline      76,160 width 430, fontSize 86, fill #0f172a
body          76,430 width 410, fontSize 34, fill #475569
cta-bg        76,1130 width 320 height 84 rx 42 fill #f97316
cta           76,1152 width 320, fontSize 28, align center, fill #ffffff
```

## Bold-type poster (1080×1350)

```text
background    0,0 fill #111827
accent-top    0,0 1080×16 fill #22d3ee
headline      76,150 width 928, fontSize 150, lineHeight 0.9, fill #ffffff
headline-2    76,470 width 928, fontSize 150, lineHeight 0.9, fill #f97316
body          76,880 width 760, fontSize 40, fill #cbd5e1
date          76,1180 width 500, fontSize 28, fill #94a3b8
```

## Quote card (1080×1350)

```text
background    0,0 fill #fdf6ec
quote-mark    76,60 width 300, text "“", fontSize 260, fontFamily Abril Fatface, fill #f97316
quote         130,360 width 820, fontSize 64, lineHeight 1.2, fill #1f2937
divider       130,930 width 120 height 6 fill #f97316
author        130,980 width 700, fontSize 32, fill #6b7280
avatar        130,1080 radius 56 (optional)
```

## Story announcement (1080×1920)

```text
background    0,0 fill #0f172a
glow          540,300 radius 420 fill #1e293b
eyebrow       96,300 width 700, fontSize 34, fill #22d3ee
headline      96,380 width 888, fontSize 132, lineHeight 0.98, fill #ffffff
body          96,1000 width 760, fontSize 44, fill #cbd5e1
date          96,1500 width 700, fontSize 34, fill #94a3b8
cta-bg        96,1640 width 420 height 104 rx 52 fill #22d3ee
cta           96,1668 width 420, fontSize 34, align center, fill #0f172a
```

## Product card (1080×1080)

```text
background    0,0 fill #ffffff
photo         90,90 900×600 (product image)
badge         790,120 radius 100 fill #f97316
badge-text    790,190 width 200, fontSize 26, align center, fill #ffffff
title         90,740 width 900, fontSize 74, fill #111827
price         90,850 width 500, fontSize 64, fill #f97316
cta           90,940 width 300 height 72 rx 36 fill #111827
cta-text      90,958 width 300, fontSize 26, align center, fill #ffffff
```

## Carousel page set

Keep the same frame and margins on every page; vary only the content block and
accent. Pages are stored in `pages[]`; each page has its own `objects`.

```json
{
  "pages": [
    { "id": "page-1", "objects": [ ] },
    { "id": "page-2", "objects": [ ] }
  ]
}
```

Do not reuse object IDs across pages.

## Spacing rules

- Headline to body: 32–56 px.
- Body to CTA: 48–72 px.
- CTA height: 80–104 px; radius = half the height for a pill.
- Eyebrow: 24–34 px, uppercase, letter-spaced if the font allows.
- Keep one dominant focal point; do not put every element at the same weight.
