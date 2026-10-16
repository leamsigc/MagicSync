---
name: business-workspace-hub
description: Consolidate sibling business pages into the tabbed workspace hub at /app/business/[id]/content (Edit, Playbook, Content, Brand Base, Publishing), redirect old URLs, and keep per-tab pages self-contained. Use when adding a tab, moving a business page, or when a business route "should just be a tab".
---

# Business workspace hub

## When to use
Adding a tab to the business workspace, moving a page into it, or fixing a
business route that users reach only by back links.

## Steps
1. **A tab is a route** under `packages/site/app/pages/app/business/[id]/content/`.
   No parent `content.vue` shell — a `<NuxtPage/>` parent would wrap the board's
   `[itemId]` drill-in in tabs too.
2. **Render `BusinessWorkspaceTabs`** (connect layer) at the top of each tab page
   with `:business-id` and the `active` key. Add the tab to its `tabs` computed
   and to `workspace_tabs` in `business.json` (all four locales).
   Do **not** add it to `content/[itemId].vue` (a drill-in, not a tab).
3. **Redirect the old URL** with a tiny page: `await navigateTo(newPath, { replace: true })`.
4. **Repoint internal links** (business card, add-business, flow stepper, dead links).
5. **Fix the moved page's i18n** — a relative `<i18n src="…">` resolves against
   the new directory. Move the `.json` alongside it, or update the `#site/...` path.
6. **Static beats dynamic**: `content/edit.vue` outranks `content/[itemId].vue`, so
   `/content/edit` is never read as an item id. Keep tab names non-UUID-looking.

## Creation flow (same PR)
- Keep the flow to website → extract → review; delete friction steps before the
  user owns a business.
- **Selections must be persisted**: step state lives on the modal, not the
  extracted result, so merge channels/competitors into `entityDetails` in
  `submitFinalForm`. Never let a payload hardcode `channels: []`.

## Gotchas
- `entity_details.details` is `mode: 'json'` — write objects, never
  `JSON.stringify` (double-encodes). See `entitydetails-json-integrity`.
- Use semantic tokens (`bg-elevated`, `text-muted`, `border-default`) not
  hardcoded `bg-[#111111]` / `text-white/40`, so light mode works.
- Keep actions in an overflow menu, not four always-visible buttons.

## Verify
1. Each tab renders standalone; old URLs redirect.
2. `pnpm audit:layers` passes; changed SFCs compile (`@vue/compiler-sfc`).
3. Creating a business saves channels + competitors into `entity_details`.
