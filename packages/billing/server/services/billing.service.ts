import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { auth } from '#layers/BaseAuth/lib/auth'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { resolveAccess, type AccessSummary } from '#layers/BaseBilling/server/utils/entitlement'
import Stripe from 'stripe'
import type { H3Event } from 'h3'

/**
 * Billing reads, deliberately small.
 *
 * When Stripe is configured the Stripe customer is the source of truth for the
 * payment method, the billing address and the invoice history; the better-auth
 * Stripe plugin is the source of truth for the current subscription (it is the
 * thing that receives the webhooks). When Stripe is not configured every read
 * degrades to an empty, `configured: false` overview instead of erroring, so a
 * self-hosted deployment without keys still renders the billing page.
 *
 * Usage (members, projects, storage) is composed on the client from data it
 * already holds — the service returns limits, never invented counts.
 */

export interface BillingPaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export interface BillingInvoice {
  id: string
  number: string
  /** ISO date. */
  date: string
  amount: number
  currency: string
  status: string
}

export interface BillingSubscription {
  plan: string
  status: string
  seats: number
  billingInterval: string | null
  renewsAt: string | null
  cancelAtPeriodEnd: boolean
  limits: Record<string, number> | null
}

export interface BillingOverview {
  configured: boolean
  /** Who may use the app and why — admin, paid, trialing, on trial, or expired. */
  access: AccessSummary
  subscription: BillingSubscription | null
  paymentMethod: BillingPaymentMethod | null
  billingEmail: string | null
  billingAddress: string | null
  taxId: string | null
  invoices: BillingInvoice[]
}

const EMPTY_OVERVIEW: Omit<BillingOverview, 'access'> = {
  configured: false,
  subscription: null,
  paymentMethod: null,
  billingEmail: null,
  billingAddress: null,
  taxId: null,
  invoices: [],
}

/** The plugin's list endpoint is only typed when Stripe is compiled in. */
type SubscriptionLister = (input: { headers: Headers }) => Promise<{ plan?: string, status?: string, seats?: number, billingInterval?: string, periodEnd?: Date, cancelAtPeriodEnd?: boolean, limits?: Record<string, number> }[]>

function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

async function listSubscriptions(event: H3Event): Promise<BillingSubscription | null> {
  // The plugin's `listActiveSubscriptions` endpoint is only typed when the
  // Stripe plugin is part of the inferred auth type; when it is registered
  // conditionally it is not, so the api surface is read without a chained cast.
  const api: Record<string, unknown> = auth.api
  const lister = api.listActiveSubscriptions as SubscriptionLister | undefined
  if (!lister) return null
  try {
    const rows = await lister({ headers: event.headers })
    const active = rows.find(row => row.status === 'active' || row.status === 'trialing') ?? rows[0]
    if (!active) return null
    return {
      plan: active.plan ?? 'free',
      status: active.status ?? 'active',
      seats: active.seats ?? 1,
      billingInterval: active.billingInterval ?? null,
      renewsAt: active.periodEnd ? new Date(active.periodEnd).toISOString() : null,
      cancelAtPeriodEnd: Boolean(active.cancelAtPeriodEnd),
      limits: active.limits ?? null,
    }
  }
  catch (error) {
    log.error({ message: 'billing subscriptions read failed', error: String(error) })
    return null
  }
}

function toPaymentMethod(source: unknown): BillingPaymentMethod | null {
  const card = (source as { card?: { brand?: string, last4?: string, exp_month?: number, exp_year?: number } } | null)?.card
  if (!card?.last4) return null
  return { brand: card.brand ?? 'card', last4: card.last4, expMonth: card.exp_month ?? 0, expYear: card.exp_year ?? 0 }
}

function toAddress(customer: Stripe.Customer): string | null {
  const address = customer.address
  if (!address) return null
  const parts = [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
  const joined = parts.filter(Boolean).join(', ')
  return joined || null
}

function toInvoices(rows: Stripe.Invoice[]): BillingInvoice[] {
  return rows.map(row => ({
    id: row.id ?? '',
    number: row.number ?? row.id ?? '',
    date: new Date((row.created ?? 0) * 1000).toISOString(),
    amount: (row.total ?? 0) / 100,
    currency: (row.currency ?? 'usd').toUpperCase(),
    status: row.status ?? 'open',
  }))
}

async function readCustomer(stripe: Stripe, customerId: string, overview: BillingOverview): Promise<void> {
  try {
    const customer = await stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] }) as Stripe.Customer
    overview.paymentMethod = toPaymentMethod(customer.invoice_settings?.default_payment_method)
    overview.billingEmail = customer.email ?? null
    overview.billingAddress = toAddress(customer)
    overview.taxId = customer.tax_ids?.data?.[0]?.value ?? null
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 12 })
    overview.invoices = toInvoices(invoices.data)
  }
  catch (error) {
    log.error({ message: 'billing customer read failed', error: String(error) })
  }
}

export const billingService = {
  /**
   * The access decision alone. Cheap enough for a route middleware to call: it
   * reads the session and, only when a subscription might exist, the plugin.
   */
  async access(event: H3Event): Promise<ServiceResponse<AccessSummary>> {
    try {
      const user = await checkUserIsLogin(event)
      // Admins are entitled by role; skip the subscription read entirely so the
      // decision never depends on Stripe being configured.
      if (user.role === 'admin') {
        return { success: true, data: resolveAccess(user, null) }
      }
      const subscription = await listSubscriptions(event)
      return { success: true, data: resolveAccess(user, subscription) }
    }
    catch (error) {
      log.error({ message: 'billing access failed', error: String(error) })
      return { success: false, error: 'Failed to resolve access' }
    }
  },

  async overview(event: H3Event): Promise<ServiceResponse<BillingOverview>> {
    try {
      const user = await checkUserIsLogin(event)
      const stripe = stripeClient()
      const subscription = user.role === 'admin' ? null : await listSubscriptions(event)
      const overview: BillingOverview = {
        ...EMPTY_OVERVIEW,
        configured: Boolean(stripe),
        access: resolveAccess(user, subscription),
        subscription,
      }
      const customerId = (user as { stripeCustomerId?: string | null }).stripeCustomerId
      if (stripe && customerId) await readCustomer(stripe, customerId, overview)
      return { success: true, data: overview }
    }
    catch (error) {
      log.error({ message: 'billing overview failed', error: String(error) })
      return { success: false, error: 'Failed to load billing' }
    }
  },
}
