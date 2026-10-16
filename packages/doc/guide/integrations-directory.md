# Integrations Directory — Grid / List / Table

`/app/integrations` lists two things: **Providers** (the accounts you connected)
and **Pages** (the social pages under them). The Providers section now uses the
same directory shell as `/app/business` — a header with counts, a toolbar
(search, token-status, sort) and **Grid / List / Table** views.

![Integrations providers — grid view](/img/screenshots/app-integrations/page.png)

## What changed

| Area | Before | After |
|---|---|---|
| Providers layout | one 4-up card grid | Grid / List / Table with a toolbar |
| Describe | `sections.providers` heading only | header subtitle `{connected} connected · {attention} need attention` |
| Add | dashed "Add connection" tile in the grid | **Add connection** button in the page header |
| Sort / filter | none | search by provider, filter by token status, sort by recent / name / platform |
| Token health | the provider cards received `accountHealth`, which was never populated → no health shown | providers aggregate the worst health of their linked pages |
| Pages section | crashed on an account with no `entityDetail` | null-guarded |

List and table views:

![Integrations providers — list view](/img/screenshots/app-integrations/list.png)

![Integrations providers — table view](/img/screenshots/app-integrations/table.png)

## How it works

### Provider rows are Better Auth accounts

`/api/v1/accounts` returns the user's Better Auth `account` rows
(`socialMediaAccountService.getUserAccountsCompleteDetails`). Each provider card
uses `account.providerId` as its name/icon and `account.id` as its account id.

### Health is aggregated, not read directly

The health endpoint keys token health by **social account id** (`pagesList[].id`),
not by the Better Auth account id. A provider therefore has no health of its own —
`useIntegrationDirectory().worstHealth` folds the health of every page whose
`accountId` matches the provider:

```ts
providerHealth(accountId) =
  worst( pagesList.filter(p => p.accountId === accountId).map(p => health[p.id]) )
```

Worst-first ranking: `expired > expiring_soon > unknown > healthy`.

### One directory, two rendering strategies

`ConnectDirectory.vue` owns the toolbar state and the three views:

- **Grid** reuses the domain-rich `ConnectIntegrationCard` unchanged — it keeps
  the reconnect banner, the page picker and the full actions menu.
- **List / Table** are new compact rows carrying the same reconnect / disconnect
  actions (they call `useConnectionManager().HandleReconnect` /
  `handleDisconnect` directly).

The add affordance moved to the header: `ConnectAddAccount` gained a
`variant` prop (`tile` — the original dashed block — or `button`), so the same
component drives the wizard from either place.

### Actions are the same in every view

A provider row offers the same actions whether you are in Grid, List or Table —
**Pages**, **Reconnect**, **Disconnect** — and never an "Edit":

- The page picker was extracted from `ConnectIntegrationCard` into
  `ConnectPagesModal.vue`, so the directory's list/table menus can open the same
  modal the grid card does.
- `ConnectIntegrationCard` gained a `showEdit` prop; the providers grid passes
  `:show-edit="false"` (the Pages section, which has no menu, is unaffected).

![List row actions show Pages / Reconnect / Disconnect](/img/screenshots/app-integrations/list-actions.png)

### Status vocabulary stays consistent

`useIntegrationDirectory` maps an item to one label every view agrees on:

- not connected → "Not connected"
- connected, health unknown → "Connected"
- connected, health known → "Healthy" / "Expiring soon" / "Expired"

So the grid's "Connected" badge and the table's status column never disagree.

## Gotchas

- **Nested composable folders are not auto-imported.** `useConnectionManager`
  lives in `app/composables/connect/integrations/` and is imported explicitly
  everywhere; a new file beside it (`useIntegrationDirectory`) needs the same
  explicit import or the page 500s with `... is not defined`.
- **One render error empties the whole page.** The Providers directory showed
  `0 connected` because the *Pages* section threw on `social.entityDetail.details`
  when an account had no `entityDetail` — Vue aborted the component's patch, so
  the provider list never re-rendered. Guard optional chains on relation data
  (`entityDetail?.details?.picture`).
- The **`credential` account** (email/password login) appears in the provider
  list. That is pre-existing behaviour of `/api/v1/accounts`, left unchanged here.

## Files touched

- `packages/connect/app/composables/connect/integrations/useIntegrationDirectory.ts` (new)
- `packages/connect/app/components/connect/integrations/ConnectDirectory.vue` (new)
- `packages/connect/app/components/connect/integrations/ConnectPagesModal.vue` (new — extracted page picker)
- `packages/connect/app/components/connect/integrations/ConnectAddAccount.vue` (`variant` prop)
- `packages/connect/app/components/connect/integrations/ConnectIntegrationCard.vue` (`showEdit` prop, uses the extracted modal)
- `packages/site/app/pages/app/integrations/index.vue` (rewired + null guards)
- `packages/site/app/pages/app/integrations/connect.json` (new keys, 4 locales)

## Verify

```bash
pnpm --filter @local-monorepo/site exec playwright test posts-feed-business.spec.ts --reporter=list
```

Captures `/img/screenshots/app-integrations/{page,list,table}.png`.
