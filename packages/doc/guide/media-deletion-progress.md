# Media Deletion Progress

Deleting selected library assets used to be fire-and-forget. Now the delete
runs as a visible background batch: a progress modal lists every queued file
with per-file status, it minimizes to a floating pill so work can continue,
and a toast reports the outcome. Verified in a real browser against the dev
server with slowed DELETE responses: 12 checks, all passing.

## What landed

| File | Job |
|---|---|
| `packages/assets/app/composables/useAssetManagement.ts` | module-level deletion queue: `deletionItems`, `isDeletingAssets`, `deleteAssets(ids)`, `clearDeletionHistory()` |
| `packages/assets/app/components/assets/media/components/AssetDeletionProgressModal.vue` (+ `.json` en/es/de/fr) | modal + floating pill, driven by the shared queue; raises the completion toast |
| `packages/site/app/pages/app/media/index.vue` | confirm modal → `deleteAssets(ids)`; mounts the progress modal once |
| `packages/assets/app/components/assets/media/components/MediaPageHeader.vue` | `deleteBusy` disables the header delete button while a batch runs |
| `packages/assets/app/components/MediaGallery.vue` | gallery delete path feeds the same queue (dead `delete` emit removed) |

## How it works

```
header "Delete Selected (n)"  ─┐
gallery toolbar delete  ────────┤
                                ▼
                    confirm modal (states the count)
                                ▼
                    deleteAssets(ids)  →  isDeletingAssets = true
                                │
              ┌─────────────────┼─────────────────┐
              │ parallel DELETE /api/v1/assets/[id] per item
              │ each item: pending → deleting → deleted | error
              └─────────────────┼─────────────────┘
                                ▼
                    isDeletingAssets = false → completion toast
                    (success: "n file(s) deleted" / partial: "Deleted x, failed y.")
                    modal auto-resets 1.8s after the batch
```

Deletion state lives **module-level** in `useAssetManagement`, so the page
header, the gallery, and the modal — three separate component instances —
observe one queue. The modal watches `isDeletingAssets`: `true` opens it
(un-minimized), the `true → false` transition fires the toast and starts the
reset timer. Closing the modal (`X`) while a batch runs minimizes to the
pill instead of cancelling; "Run in background" does the same explicitly.
Clicking the pill reopens the modal mid-batch. After completion, Close /
auto-reset clears the history.

Single-file failures don't abort the batch: each request settles
independently (`Promise.all` over per-item try/catch), the modal ticks per
file, and failures render inline with the error message.

## Gotcha found while verifying

**The modal never mounted — silent auto-import failure.** The page used a
bare `<AssetDeletionProgressModal />` with no import, and the browser E2E
showed the DELETEs succeeding with no modal ever appearing plus
`[Vue warn]: Failed to resolve component: AssetDeletionProgressModal` in the
console. The component lives three levels deep
(`app/components/assets/media/components/`); its siblings in the same
directory are all explicitly imported in that page, and the fix follows suit:

```ts
import AssetDeletionProgressModal from '#layers/BaseAssets/app/components/assets/media/components/AssetDeletionProgressModal.vue'
```

Top-level layer components (e.g. `MediaGallery.vue`) still resolve via
auto-import. When a layer component doesn't render and there's no build
error, check the browser console for the resolve warning before assuming a
state bug.
