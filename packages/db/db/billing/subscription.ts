import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Subscriptions written by the better-auth Stripe plugin
 * (`@better-auth/stripe`). The column set mirrors the plugin's `subscription`
 * model one-for-one, so the drizzle adapter maps every field without a `schema`
 * override. The table only carries rows when Stripe is configured; without
 * `STRIPE_SECRET_KEY` the plugin is not registered and nothing writes here.
 */
export const subscription = sqliteTable('subscription', {
  id: text('id').primaryKey(),
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').default('active'),
  periodStart: integer('period_start', { mode: 'timestamp' }),
  periodEnd: integer('period_end', { mode: 'timestamp' }),
  trialStart: integer('trial_start', { mode: 'timestamp' }),
  trialEnd: integer('trial_end', { mode: 'timestamp' }),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  cancelAt: integer('cancel_at', { mode: 'timestamp' }),
  canceledAt: integer('canceled_at', { mode: 'timestamp' }),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  seats: integer('seats'),
  billingInterval: text('billing_interval'),
  stripeScheduleId: text('stripe_schedule_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})
