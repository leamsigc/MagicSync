# The Platform Preview System

`packages/scheduler/app/components/scheduler/posts/previews/` replaces twelve
hand-written per-platform preview components with one spec table, one registry,
and four shared chrome components. This page is W5 — the system. W6 adds the 17
renderers on top of it.

## What was wrong

The twelve components in
`packages/scheduler/app/components/scheduler/posts/components/` carried defects
that a single template could not have:

- **Invented engagement.** `17K`, `7.7K shares`, `300.2K`, `1000.6K Views`,
  `84.2K`, `1024`, `30K`, `758` — a scheduled post publishing with any of these
  is a lie, and it is the same lie on every platform.
- **Invented timestamps.** `FacebookPreview.vue` computed
  `dayjs().subtract(1, 'day').hour(12).minute(49)` and printed "Today at 11:49
  AM". Others used `dayjs(new Date())` and called it "just now".
- **An invented avatar.** A GitHub avatar URL hardcoded in `TwitterPreview.vue`
  and `EmailPasswordPreview.vue`.
- **Six byte-identical clones** of one generic template, differing only in the
  words "Like", "Comment", "Share".
- **Two dispatch tables** — `PhonePreview.vue`'s 13-case `switch` and the old
  `PostCalendarPreview.vue`'s `previewsMap` — that could drift apart.
- `MastodonPreview.vue` never rendered media at all.

## The shape

```
previews/
  platformPreviewSpecs.ts   one PlatformPreviewSpec per platform — the table
  previewRegistry.ts        platform → renderer component — the dispatch
  PostPreviewShell.vue      avatar, name, handle, timestamp, badge, wordmark
  PostPreviewMedia.vue      layout + maxImages cap + +N badge
  PostPreviewActions.vue    the action bar, from spec.actions
  PostPreviewContent.vue    link / hashtag / mention / email tokenizer
```

A renderer composes the three chrome pieces and draws only the platform-specific
bits:

```vue
<PostPreviewShell :platform="platform" :post="post" :spec="spec">
  <template #media>
    <PostPreviewMedia :assets="assets" :platform="platform" :spec="spec" :format="format" />
  </template>
  <template #actions>
    <PostPreviewActions :spec="spec" :platform="platform" />
  </template>
  <template #comments>
    <!-- real per-platform publish state, or nothing -->
  </template>
</PostPreviewShell>
```

### The spec table is the branch-free contract

`PlatformPreviewSpec` has ten fields and the four that have a source of truth
are derived from it, never retyped:

| Spec field | Derived from |
|---|---|
| `showsComments` | `platformConfigurations[p].supportsComments` |
| `linkPreview` | `platformConfigurations[p].supportsLinkPreviews` |
| `singleAspect` | `mediaConstraints.aspectRatios.recommended[0]` |
| media cap | `platformConfigurations[p].maxImages` |

Everything else — `nameSource`, `handle`, `timestamp`, `mediaLayouts`,
`actions`, `verifiedBadge`, `maxComments` — has no column anywhere, so it is
hand-authored from each platform's real card and flagged in a comment where it
is a judgement call.

Layouts are shared fragments (`GRID_LAYOUTS`, `CAROUSEL_LAYOUTS`,
`SINGLE_LAYOUTS`, `VIDEO_LAYOUTS`, `NO_MEDIA_LAYOUTS`) so a platform's whole
media behaviour is one line, not four.

### Every branch decision is a lookup table

Four lookup tables carry what used to be `if` trees:

- asset count → layout key (`LAYOUT_KEY_BY_COUNT`)
- layout → container classes (`CONTAINER_CLASSES`)
- layout → item classes (`ITEM_CLASSES`)
- aspect ratio → Tailwind class (`ASPECT_CLASSES`, because Tailwind cannot see
  a runtime-built class string and would never generate it)

Plus `TIMESTAMP_FORMATTERS`, `HANDLE_FORMATTERS`, `TOKEN_MATCHERS`,
`TOKEN_CLASSES`, `TOKEN_ENABLED`.

The heaviest new function is **2 branches** (`PostPreviewContent.vue`'s
`tokens` computed); everything else is 0 or 1.

## The correctness rule that changes the product

A post that is `draft`, `pending` or `failed` has published nothing. So:

```ts
hasPublished(post) // post.status === 'published'
```

`PostPreviewShell` folds that into the comments slot:

```ts
const showsComments = computed(() => props.spec.showsComments && published.value)
```

- **Unpublished** → the card renders its structural chrome exactly as it will
  look. No counts. No comments. `PostPreviewActions` is labels and icons only,
  in every mode.
- **Published** → real state, through the `:published` and `:platform-states`
  slot props.

`post.platformPosts` has **no platform column** — the platform hangs off
`socialMediaAccounts` — so the row list is exposed as-is and never keyed by
platform. A renderer shows the history that exists and does not attribute a row
to a tab it cannot prove.

## What W5 refused to invent

| Field | Why it is not on the card |
|---|---|
| Handle | no handle column exists. The shell slugs the display name |
| Platform host | no host on the row, so `at-instance` renders `@slug` alone |
| Verified badge | no verification field on `posts`, `user` or `platformPosts`. `isVerifiedKnown()` is hard-false |
| Publish timestamp | `publishedAt ?? scheduledAt`; neither set → no timestamp rendered, never "just now" |
| Per-platform publish row | see above |
| Business logo | `business` is `{ id, name }` only |
| Engagement counts | not on the row, in any mode |

## Wiring (W6)

```ts
const { specFor, resolvePreview, contentFor, assetsFor } = usePlatformPreview()
```

`resolvePreviewComponent` is one table lookup: `undefined`, an unknown key and
`email-password` all land on `default`. Nine keys carry a `// W6:` placeholder
comment pointing at the closest existing component; W6 swaps the value only.

## Verification notes

`pnpm --filter @local-monorepo/scheduler build` alone does not prove these files
compile, because nothing imports them yet — they are tree-shaken out. W5 was
verified by a temporary `.playground/app.vue` that rendered every platform
through the system, which was removed after the build passed.
