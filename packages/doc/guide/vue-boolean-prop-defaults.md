# Vue Boolean prop defaults (the vanishing preview)

## The bug

The post preview disappeared from `/app/posts/new` (and every modal that embeds
the composer) after commit `f3cd029c` swapped a reactive-destructure default for a
computed fallback:

```ts
// before — worked
const { initialPost, preview = true } = defineProps<{ initialPost?: PostWithAllData; preview?: boolean }>()

// after — silently wrong
const props = defineProps<{ initialPost?: PostWithAllData; preview?: boolean }>()
const preview = computed(() => props.preview ?? true)
```

`preview` stayed `false`, so `<div v-if="preview">` never rendered.

![Post composer preview restored](/img/screenshots/app-posts-new/page.png)

## Why `?? true` cannot work here

Vue applies **Boolean casting**: a prop declared as `Boolean` with **no default**
is cast to `false` when the parent omits it — before any computed code runs. So
`props.preview` is `false`, never `undefined`, and `false ?? true` is `false`.

`??` only guards `null`/`undefined`. Boolean casting removed the `undefined`.

The original `= true` in the destructure was not sugar — it registered a real
prop default, which is the only thing that overrides boolean casting.

## The fix

Declare the default where Vue reads it — in the prop definition:

```ts
const props = withDefaults(defineProps<{
  initialPost?: PostWithAllData
  preview?: boolean
}>(), { preview: true })

const preview = computed(() => props.preview) // now true when omitted
```

The same fix was applied to `CollapsibleSection.vue` (`defaultOpen`), which had
the identical `props.defaultOpen ?? true` mistake.

## Gotchas

- This trap is invisible in review: the fallback *looks* defensive. Grep for
  `props.<x> ?? true` on any `?: boolean` prop — it always means "false".
- Components that pass the prop explicitly (`:preview="false"` in
  `TwitterPostEditor.vue`) are unaffected either way.
- Don't "fix" it with `props.preview === undefined ? true : props.preview` — the
  cast already happened; `undefined` is unreachable.
- `withDefaults` is a compiler macro — no import needed.

## Verify

1. `/app/posts/new` renders the phone preview with no `preview` prop passed.
2. `NewPostModal`, `NewCalendarPostModal`, `UpdatePostModal` show the preview.
3. `TwitterPostEditor` (explicit `:preview="false"`) still hides it.
4. Carousel editor sections start expanded.
