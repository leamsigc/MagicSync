---
name: modal-picker
description: UModal that lists server-backed items for selection plus option checkboxes, then POSTs the choice with loading/toast/i18n feedback
triggers:
  - "picker modal"
  - "select modal"
  - "repurpose"
  - "confirm selection"
edges:
  - target: context/conventions.md
    condition: when checking motion, toast, and i18n rules
last_updated: 2026-09-12
---

# Modal Picker (Select + Confirm)

## Context

Used when a toolbar/quick action needs a source item plus options before POSTing:
`UModal v-model:open` with `#body` (loading / empty / list states) and `#footer`
(cancel + confirm). Precedents: auto-reply media picker
(`packages/site/app/pages/app/auto-reply/index.vue`), pipeline repurpose picker
(deleted 2026-10-02 with `/app/pipelines`; auto-reply remains the live precedent).

## Steps

1. State (all `ref`, one concern each): `pickerOpen`, `pickerItems`, `pickerLoading`,
   `confirmLoading`, `selectedId: string | null`, option booleans as a record
   (e.g. `ref({ posts: false, carousels: false })` — binds directly to `UCheckbox v-model`).
2. Named handlers only, each ≤5 branches:
   - `handleOpenPicker` — reset selection, set `pickerOpen = true`, `await loadPickerItems()`
   - `loadPickerItems` — `$fetch` list endpoint with scoping query
     (`businessId`, `status`, `limit`); on `catch` show error toast; `finally` clears loading
   - `handleSelectItem(id)` / `handleClosePicker` — single-assignment setters
   - `handleConfirmPicker` — guard missing selection (error toast + return),
     guard empty options (error toast + return), set `confirmLoading`,
     `try` POST → success toast + close, `catch` error toast, `finally` clear loading
3. Template: `<UModal v-model:open :title="t(...)" :description="t(...)"
   :ui="{ content: 'md:min-w-[720px]' }">`. Body branches loading spinner →
   empty (`v-motion-fade`) → list (`v-motion-fade`) of `type="button"` cards with
   selected ring class + `UBadge` check. Footer: ghost cancel, primary confirm
   with `:loading="confirmLoading"`.
4. i18n: every string via `t()` in the page JSON × all locales present
   (title, description, empty, labels, cancel, confirm, guards, success, failure).
   List rows render data fields through small format helpers
   (snippet truncation, safe JSON/array joins) — never raw `JSON.parse` in template.
5. Never add backend surface for the picker: reuse existing list + action endpoints
   (verify request schemas by reading them; do not change them).

## Gotchas

- Single-select uses `selectedId: string | null`, not an array — the Zod action
  schema takes one `sourcePostId`.
- `??` / `?.` don't count toward the 5-branch budget; `||`, ternaries, `catch` do.
- Keep the trigger button's original behavior for other kinds untouched —
  branch on `kind` first, return early.
