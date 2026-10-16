---
name: media-deletion-progress
description: Background batch deletion with live per-file progress modal, minimizing to a floating pill, plus completion toast. Use when asked to "deletion progress", "background delete", "delete modal", "floating pill", "batch delete with progress", or "asset deletion UX".
---

# Media Deletion Progress

## When to use

Any multi-item delete that should stay visible while the user keeps working.
Reference run: media library assets (MagicSync), 2026-10-16 — 12 browser
checks green.

## Ground truth (check first)

- Queue: `packages/assets/app/composables/useAssetManagement.ts`
  (`deletionItems`, `isDeletingAssets`, `deleteAssets`, `clearDeletionHistory`
  — all module-level so header/gallery/modal share one queue).
- UI: `packages/assets/app/components/assets/media/components/AssetDeletionProgressModal.vue`
  (+ 4-locale `.json`).
- Mount: once on the owning page (`/app/media`), with an explicit import
  (see Gotchas).

## Steps

1. **State module-level, not per-instance.** Separate component instances
   (trigger button, gallery, modal) must observe the same refs — a
   per-instance ref leaves the executor reading an empty selection.
2. **Executor:** guard re-entry + empty input, set items to `pending`,
   flip `isDeletingAssets`, run one request per item in parallel with
   per-item try/catch (`pending → deleting → deleted | error`), prune
   successes from local lists, flip the flag back.
3. **Modal reacts to the flag:** `isDeletingAssets → true` opens it
   (un-minimized); `true → false` fires the toast
   (success vs partial counts) and starts a short reset timer (~1.8s) that
   closes and clears history.
4. **Minimize, never cancel:** closing/X during a batch minimizes to the
   pill; "Run in background" button does the same; pill click reopens
   mid-batch. After completion, Close clears the pill.
5. **Confirm-first:** destructive batches confirm with the count up front
   ("Delete 3 assets?"); the header button shows the count and disables via
   the busy flag while a batch runs.
6. **i18n:** component JSON alongside (`en/es/de/fr`), all copy via `t()`;
   named handlers only (`minimizeModal`, `reopenModal`, `closeModal`,
   `handleOpenChange`).

## Verify (no unit tests)

- Browser (Playwright, real session): seed N fixture rows, slow the DELETE
  route (route interception + delay) so progress is observable.
- Select → header count button → confirm states count → progress modal lists
  N items → "Run in background" → pill shows `Deleting x/N` → pill click
  reopens mid-batch → done heading + toast reports N files → Close clears
  pill → DB rows gone → gallery no longer lists them → zero pageerrors.
- Without the delay the batch settles before the pill can be clicked — the
  delay simulates realistic latency, not a race in the code.

## Gotchas

- **Bare `<Component/>` may silently not mount.** If deletes succeed but no
  modal appears, check the console for
  `[Vue warn]: Failed to resolve component`. Deeply nested layer components
  may need an explicit `#layers/...` import even though top-level ones
  auto-import — follow the importing file's existing convention.
- A completion toast bottom-right can cover the pill in tests; click the
  pill mid-batch, not after completion.

## Update Scaffold

- [ ] Wiki: `/guide/media-deletion-progress`
- [ ] `.claude/patterns/media-gallery.md` if queue/modal behavior changes
