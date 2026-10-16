# Content Board Refresh, Profile Merge, and Billing

This page records the work done in one pass on 2026-10-16: the content board was
restyled to a task-card look, `/app/account` was folded into `/app/profile`, a
new **billing layer** was added, and Snapchat was connected end to end.

## 1. Content board (`/app/business/[id]/content`)

**What changed.** Columns are now bordered panels with a header that carries the
column mark, its name, its count, a `+` and a `…` menu, and a footer **Add
task**. Cards became task cards: a chip row (the deliverable, then up to two
platforms), the title (struck through with a green check in Published), and a
meta line with a short board code, a priority mark, a relative date and an
avatar for whoever made the card. Right-clicking — or the `…` — opens a context
menu: Open, Edit, Write now, a **Status** submenu (the columns the state machine
will actually accept), Copy link, and Delete.

**Why.** The old board was single-line rows with no way to see the deliverable,
the platform or the age of a card at a glance.

**How it works.** The board keeps its existing state machine; the new
presentation is derived from data the server already returns:

- `packages/connect/app/utils/content-card.ts` — pure helpers: `contentCardCode`
  (`CNT-` + the last three id characters), `cardDayLabel` (Today / Yesterday /
  weekday / `Mon D`), `cardDate` (published → scheduled → updated) and
  `priorityTier`.
- `ContentBoardCard.vue` / `ContentBoardColumn.vue` — the presentation. The
  avatar shows `AI` for agent-made cards and the signed-in owner's initials for
  their own.
- Card i18n lives in `packages/site/app/pages/app/business/[id]/content.json`.

**Honest limits.** The reference design shows a progress bar; the board has no
progress data, so no bar is drawn rather than a fabricated one. "Add task"
appears on **Planned** only, because that is where a new card actually lands —
the other columns would have to lie about filing. The reference's Assign to /
Priority / Move to project / favourites / Duplicate / Archive items are omitted:
the board has no assignee, project, or duplicate/archive action.

## 2. Single profile view

**What changed.** `/app/profile` is now the one profile + account page:
a header (avatar, name, role badge, email, verified state, member-since), a
four-up strip (businesses, linked accounts, role, email), then tabs for Profile,
Account, Linked accounts, AI model and Danger zone, with the avatar uploader and
quick links in a side column. **`/app/account` was removed** and every internal
link now points at `/app/profile`.

**How it works.** The account panels (`AccountSettings`, `LinkedAccounts`,
`AiModelSettings`, `DangerZone`) are reused unchanged; their translation file
moved out of the `pages/` tree to
`packages/auth/app/components/auth/account/components/account.json` so no route
directory holds a stray file. The four-up strip is composed from data the page
already loads (`useBusinessManager`, `UseUser().getUserAccountList`).

## 3. Billing layer (`/app/billing`)

**What changed.** A new Nuxt layer, `packages/billing`, plus a page at
`/app/billing` with three tabs: **Plan** (current subscription, usage meters,
plan comparison), **Payment** (card, billing email/address, tax id) and
**Invoices** (past invoices). All three read the Stripe customer through
`/api/v1/billing/overview`.

**Why.** There was no billing surface at all.

**How it works.**

- The layer (`$meta.name: 'BaseBilling'`) extends `db`, `ui` and `auth`, and is
  registered in `packages/site/nuxt.config.ts`.
- `packages/billing/app/utils/billing-plans.ts` holds the display catalog
  (prices, limits, feature keys). Stripe remains the authority for charges.
- `packages/billing/server/services/billing.service.ts` reads the current
  subscription through the better-auth Stripe plugin
  (`auth.api.listActiveSubscriptions`) and the customer, payment method and
  invoices through the Stripe SDK. Without `STRIPE_SECRET_KEY` it returns
  `configured: false` and the page renders its empty state.
- `packages/billing/app/composables/useBilling.ts` owns the read and hands
  upgrades / the customer portal to `authClient.subscription`.

**Enabling Stripe.** Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_TEAM` and `STRIPE_PRICE_BUSINESS`; the plugin in
`packages/auth/lib/auth.ts` registers itself only when the key and webhook
secret are present. Point the Stripe webhook at `/api/auth/stripe/webhook`. The
`subscription` table and the two `stripe_customer_id` columns are added by
migration `0012_complete_blonde_phantom.sql`. The full walkthrough — products,
prices, webhook events, customer portal, migration, testing — is
[Connecting Stripe](/guide/stripe-setup).

**Who may use the app.** `packages/billing/server/utils/entitlement.ts` decides,
server-side:

- **Admins never pay.** `role === 'admin'` is entitled unconditionally, and the
  subscription lookup is skipped so admin access never depends on Stripe.
- **Every new account gets a 10-day free trial** (`TRIAL_DAYS`), counted from
  `createdAt` — derived, so it cannot drift from the user row.
- A paid subscription (`active` / `trialing`) wins over the trial.

The states are `admin`, `active`, `trialing`, `trial`, `expired`, and the billing
page shows a banner for the one that applies. Blocking is **off by default**
(`BILLING_ENFORCE_ACCESS=true`, or `NUXT_PUBLIC_BILLING_ENFORCE` at runtime) —
inverting the default would lock out every account that predates billing. With it
on, `05.billing-access.global.ts` redirects an expired account to `/app/billing`
and fails open if the lookup errors.

## 4. Snapchat

See [Snapchat Integration](/guide/snapchat-integration) for the full setup
guide. In short: an inline `genericOAuth` provider (no extra dependency), a
`SnapchatPlugin`, and the platform registered in the shared constants, the
database enum, the plugin matcher, and the platform icon / filter / preview
tables.
