---
name: vue-boolean-prop-defaults
description: Restore a Vue boolean prop default that `props.x ?? true` silently ate — Vue casts an absent Boolean prop to false before any fallback runs, so the default must live in withDefaults. Use when a UI element "disappeared", "never renders", "was working before", or when reviewing `props.<x> ?? true` / `?? false` on a `?: boolean` prop.
---

# Vue Boolean prop defaults

## When to use
A conditional block (`v-if="someFlag"`) stopped rendering, or a component "lost"
a feature, after a props refactor. Or you are reviewing any
`props.<x> ?? true` fallback on an optional boolean prop.

## Root-cause pattern
Vue applies **boolean casting**: a prop whose runtime type is `Boolean` with **no
declared default** becomes `false` when the parent omits it — *before* any
computed/fallback code runs. So:

```ts
const props = defineProps<{ preview?: boolean }>()
const preview = computed(() => props.preview ?? true) // props.preview is `false`, not undefined → false
```

`??` guards only `null`/`undefined`; boolean casting already removed the
`undefined`. The old reactive-destructure form `const { preview = true } =`
created a real prop default, which is what overrode the cast.

## Steps
1. Find the prop and its intended absent-value:
   ```bash
   grep -rnE "props\.[A-Za-z]+ \?\? (true|false)" packages
   ```
   Every hit on a `?: boolean` prop is a bug (the literal is dead).
2. Declare the default in the prop definition, not in a computed:
   ```ts
   const props = withDefaults(defineProps<{
     myFlag?: boolean
   }>(), { myFlag: true })
   ```
3. Use the prop directly (`const flag = computed(() => props.myFlag)`), or plain
   `props.myFlag` in the template. Keep the name the template already uses.
4. If the file also has a bare event-handler assignment
   (`@click="open = !open"`), replace it with a named handler while you are there.

## Gotchas
- Never "fix" it with `props.x === undefined ? true : props.x` — `undefined` is
  unreachable after the cast; the value is already `false`.
- `withDefaults` is a compiler macro; no import.
- Callers that pass the prop explicitly are unaffected — only omitted props break.
- `?? true` on a **non-boolean** optional prop (string/number/object) is fine;
  this trap is specific to `Boolean`.

## Verify
1. The component renders the conditional block when the prop is omitted.
2. Callers that pass the prop explicitly still behave (e.g. `:preview="false"`).
3. Parse the SFC with `@vue/compiler-sfc` (`parse` + `compileTemplate`) to prove
   the template still compiles.
