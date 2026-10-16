# Connecting Stripe

Everything needed to take payments in MagicSync. Work through it top to bottom;
step 7 is the one that is easy to forget.

> The billing feature is **optional and inert without keys**. If you skip this
> whole page the app still runs: `/app/billing` renders its "not configured"
> state and nothing else changes.

## 1. Stripe account and mode

1. Create a Stripe account: <https://dashboard.stripe.com/register>.
2. Stay in **Test mode** until the last step. Every key and price id below has a
   test-mode twin; swapping to live mode means redoing steps 2–5 with live
   values.
3. Note your mode: a test `sk_test_…` key with a live `price_…` id fails at
   checkout with `No such price`.

## 2. Create the products and prices

In **Product catalogue → Add product**, create one product per plan:

| Plan | Name | Price | Billing | Env var |
|---|---|---|---|---|
| Team | `MagicSync Team` | `12.00 USD` | Recurring, monthly, **per unit** | `STRIPE_PRICE_TEAM` |
| Business | `MagicSync Business` | `24.00 USD` | Recurring, monthly, **per unit** | `STRIPE_PRICE_BUSINESS` |

- **Per unit is what makes "per member" work.** The billing page sets
  `seats`, and Stripe multiplies the unit price by that quantity.
- After saving, open the price, click **Copy price ID** (`price_1…`) and keep it.
- Annual billing is not wired yet: the app reads one price id per plan. Add
  `annualDiscountPriceId` in `packages/auth/lib/auth.ts` if you want it.

## 3. Environment variables

Add these to `.env` (never commit it):

```bash
# Stripe secret key — the plugin is only registered when this is present.
STRIPE_SECRET_KEY="sk_test_…"

# From the webhook endpoint you create in step 4.
STRIPE_WEBHOOK_SECRET="whsec_…"

# Price ids from step 2.
STRIPE_PRICE_TEAM="price_…"
STRIPE_PRICE_BUSINESS="price_…"
```

Restart the app. `packages/auth/lib/auth.ts` registers the Stripe plugin only
when **both** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set, so a
half-configured deployment stays inert instead of half-working.

## 4. Webhook endpoint

1. **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://<your-domain>/api/auth/stripe/webhook`
   (locally: `stripe listen` in step 9 gives you one).
3. Subscribe to these events — without them subscriptions exist in Stripe but
   the app never learns about them:

   | Event | What it drives |
   |---|---|
   | `checkout.session.completed` | The subscription created at checkout |
   | `customer.subscription.created` | Subscriptions created outside checkout (e.g. the dashboard) |
   | `customer.subscription.updated` | Plan changes, renewals, cancellation scheduled |
   | `customer.subscription.deleted` | Cancellation taking effect |

4. Copy the endpoint's **Signing secret** (`whsec_…`) into
   `STRIPE_WEBHOOK_SECRET`.

Signature verification is done by the plugin; a forged webhook is rejected
before it reaches any handler.

## 5. Customer portal

`Manage billing`, `Update` (payment method) and `Edit` (address) all open the
**Stripe customer portal**, so it must be configured or those buttons land on an
error page:

1. **Settings → Billing → Customer portal**.
2. Enable: **Customers can update payment methods**, **Invoice history**,
   **Cancel subscriptions**.
3. Add the fields the Payment tab displays: **billing address**, **tax ID**.
4. Save. No code change is needed — the app already asks for those capabilities.

## 6. Migrate the database

The plugin needs the `subscription` table and two `stripe_customer_id` columns:

```bash
cd packages/db
pnpm db:migrate          # production / configured database
pnpm db:migrate:local    # uses ../../.env
```

Migration `0012_complete_blonde_phantom.sql` is the one that adds them. Skipping
this step is the single most common failure: the Stripe plugin writes a
`subscription` row on checkout and the write fails.

## 7. How access works (do not skip)

Two rules are enforced in `packages/billing/server/utils/entitlement.ts`, always
server-side, never from anything the browser sends:

1. **Admins never pay.** A user whose `role` is `admin` is entitled
   unconditionally; the subscription lookup is skipped entirely, so admin access
   does not depend on Stripe being configured.
2. **Every new account gets a 10-day free trial.** `TRIAL_DAYS = 10`, counted
   from the account's `createdAt`. Nothing to create, nothing to expire: the
   window is derived, so it cannot drift from the account record.

A paid subscription always wins over the trial. The resolved states are
`admin`, `active`, `trialing`, `trial` and `expired`, and the billing page shows
a banner for whichever applies.

**Enforcement is off by default.** Turn it on deliberately:

```bash
BILLING_ENFORCE_ACCESS="true"
# or override at runtime, which is what a container needs:
NUXT_PUBLIC_BILLING_ENFORCE="true"
```

With it on, `packages/billing/app/middleware/05.billing-access.global.ts`
redirects an `expired` account to `/app/billing` (page middleware is skipped
there and on `/app/profile`, so a blocked user can still pay or sign out, and a
failed lookup fails **open** rather than locking someone out).

> Why the switch: inverting this default would lock out every account that
> signed up before billing existed. Enable it once you are ready for that.

## 8. Test the flow

1. Sign in as a normal user; `/app/billing` shows the trial banner with the days
   left.
2. **Upgrade** on Team → Stripe Checkout → pay with `4242 4242 4242 4242`, any
   future expiry, any CVC.
3. You land back on `/app/billing` with the banner reading "Your subscription is
   active" and the Plan tab showing Team as current.
4. **View invoices** lists the first invoice; **Update** opens the customer
   portal.
5. Cancel in the portal; the webhook flips the state back to `trial`/`expired`.

## 9. Local development

```bash
stripe login
stripe listen --forward-to localhost:3000/api/auth/stripe/webhook
```

`stripe listen` prints a `whsec_…` for the current session — use it as
`STRIPE_WEBHOOK_SECRET` locally. Trigger events without a browser with
`stripe trigger customer.subscription.updated`.

## 10. Final checklist

- [ ] Two products, both **per unit, monthly recurring**
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_TEAM`,
      `STRIPE_PRICE_BUSINESS` set, app restarted
- [ ] Webhook endpoint live with the four subscription events
- [ ] Customer portal: payment methods, invoices, cancellation, address,
      tax ID enabled
- [ ] `pnpm db:migrate` run
- [ ] Admin account shows "billing is not required"
- [ ] A brand-new account shows a trial with days left
- [ ] Test purchase completes and returns to `/app/billing` as `active`
- [ ] `BILLING_ENFORCE_ACCESS` set only when you mean to block
