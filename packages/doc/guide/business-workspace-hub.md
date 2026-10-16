# Business workspace hub

## What changed

A business used to be five sibling routes (`edit`, `playbook`, `corpus`,
`publishing`, `content`) with no way to move between them except back links. The
hub now lives at `/app/business/[id]/content` and its tabs are routes:

| Tab | Route |
|-----|-------|
| Edit | `/app/business/[id]/content/edit` |
| Playbook | `/app/business/[id]/content/playbook` |
| Content | `/app/business/[id]/content` |
| Brand Base | `/app/business/[id]/content/corpus` |
| Publishing | `/app/business/[id]/content/publishing` |

![Content tab](/img/screenshots/app-business-id-content/content-tab.png)
![Edit tab](/img/screenshots/app-business-id-content/edit-tab.png)

`BusinessWorkspaceTabs.vue` (connect layer) renders the bar on every tab page —
but not on the board's card drill-in (`content/[itemId].vue`), which is a
drill-in, not a tab.

## Why routes, not a client-side tab state

Each tab deep-links and the browser back button works. A parent
`content.vue` + `<NuxtPage/>` shell would have wrapped the item drill-in in tabs
too, so the bar is a component each page renders instead.

## Old URLs

`edit`, `playbook`, `corpus`, `publishing` are now tiny `await navigateTo(...)`
redirect pages, so old bookmarks and links keep working. Internal links were
repointed (business card, `AddBusinessModal`, `BusinessInitial`, the playbook
flow stepper, the media page's dead `/app/businesses` link).

## Creation flow

- The promo checkbox step (`StepZero`) was removed — pure friction before the
  user has a business.
- The channels and competitors chosen in the extraction step are now **persisted**:
  they live on the modal, not the extracted result, so `submitFinalForm` merges
  them into `entityDetails`. Previously `channels` was hardcoded `[]` and
  competitors were never saved at all.
- The card is now one compact row (initial, name, status, one meta line) with
  edit/playbook/Google/delete collapsed into an overflow menu.

## Gotchas

- Moving a page into `content/` changes its relative `<i18n src>`. `edit.vue`
  needs `../../business.json`; `BusinessPlaybook.vue`'s `#site/.../[id]/playbook.json`
  moved to `[id]/content/playbook.json`.
- Static tab routes (`content/edit.vue`) outrank the dynamic `content/[itemId].vue`
  — that is what keeps `/content/edit` from being read as an item id.
- `publish.vue` stays a route (the composer) and the Publishing tab links to it
  as "New publication" rather than embedding it.

## Verify

1. `/app/business/<id>/content` shows five tabs; each renders without a nested header.
2. `/app/business/<id>/edit` redirects to `/content/edit`.
3. Creating a business with channels/competitors saves them into `entity_details`.
