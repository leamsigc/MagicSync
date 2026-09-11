---
name: client-only-node-builtins
description: Fixing client-bundle crashes from Node builtins (events, buffer, path) imported in app/ code
triggers:
  - "is not a constructor"
  - "Class extends value"
  - "Qc.default"
  - "node builtin client"
edges:
  - target: context/conventions.md
    condition: when checking where client-safe code must live
  - target: patterns/debug-api.md
    condition: when the 500 only reproduces in the browser, not via curl SSR HTML
last_updated: 2026-09-10
---

# Client-Only Node Builtins

## Context

Anything under a layer's `app/` directory ships to the browser via the Vite
client bundle. Node builtins (`events`, `buffer`, `path`, `fs`, `crypto`)
have no default export there. SSR HTML can still return 200 (Node resolves
the import on the server) while hydration throws a 500 error page:

- dev: `Class extends value #<Object> is not a constructor or null`
  / `({}) is not a constructor`
- prod (minified): `Qc.default is not a constructor`

Proven by `/tools/image-editor`: `EventBus.ts` + `FabricEditor.ts` did
`import EventEmitter from 'events'` → every navigation to the page 500'd on
the client, SSR curl stayed 200.

## Steps

1. Reproduce in a real browser (curl is not enough — SSR can succeed while
   hydration fails). Capture `pageerror`:
   `Class extends value ... at <file>:<line>` points at the bad import.
2. Grep the client tree: `from 'events'` / `from "events"` under
   `packages/*/app/`. Server files (`server/`) may keep named imports
   (`import { EventEmitter } from 'events'`) — those are fine.
3. Replace the builtin with a browser-safe equivalent:
   - event emitter → minimal local `SimpleEventEmitter` (on/off/once/emit/
     removeAllListeners/setMaxListeners), single source in the feature
     folder, imported by siblings (e.g. `FabricEditor` imports from
     `./EventBus`).
   - `buffer`/`path` → `uint8array` helpers / URL APIs; `crypto` →
     `globalThis.crypto`.
4. Keep static `fabric` imports (browser entry is client-safe); only the
   Node builtin was the crash. Prefer the existing dynamic-import style
   (`await import('fabric')` in `onMounted`, see `FabricStage.vue`) for new
   canvas code.

## Gotchas

- `import { EventEmitter } from 'events'` (named) still depends on the
  Node polyfill in the client bundle — do not use it in `app/` code.
  Server-only usage is fine.
- `ClientOnly` does NOT save you: the static import is evaluated when the
  client chunk loads, before any mount guard runs.
- Production renames the module (`Qc`), so the prod message never mentions
  `events` — always confirm against dev `pageerror` output.

## Verify

- [ ] No `from 'events'` (or other Node builtins) under any `packages/*/app/`
- [ ] Page title is the real title (not `500 - ...`), `#workspace canvas`
      renders, zero `pageerror`/console-error entries
- [ ] New emitter methods stay ≤ 5 branches each (count `if`/`case`/`catch`/
      loops/`&&`/`||`/ternary; `??`/`?.` don't count)

## Debug

**Still 500 after the swap:** check for a second importer of the same
builtin (`FabricEditor.ts` imported `events` independently of `EventBus.ts`).

**`Buffer is not defined` / `process is not defined`:** same class of bug,
different builtin — apply the same Steps.

## Update Scaffold
- [ ] Update `.mex/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.mex/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.mex/patterns/` and add to `INDEX.md`
