/**
 * The billing catalog.
 *
 * Stripe owns the money: the price ids live in the environment and the plugin
 * registered in `packages/auth/lib/auth.ts` is the authority for charges. This
 * catalog only supplies what the UI has to draw — the display price, the plan
 * limits the usage meters compare against, and the feature list — so those
 * numbers live in one place instead of being scattered across components.
 *
 * A limit of `-1` means "no limit".
 */

export type BillingPlanId = 'free' | 'team' | 'business'

export interface BillingPlanLimits {
  members: number
  storageGb: number
  projects: number
}

export interface BillingPlan {
  id: BillingPlanId
  /** Display-only monthly price per member, in whole currency units. */
  priceMonthly: number
  limits: BillingPlanLimits
  /** Feature keys under `plans.<id>.features.<key>` in the locale file. */
  features: string[]
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'free',
    priceMonthly: 0,
    limits: { members: 3, storageGb: 5, projects: -1 },
    features: ['members', 'unlimitedTasks', 'storage'],
  },
  {
    id: 'team',
    priceMonthly: 12,
    limits: { members: 50, storageGb: 100, projects: -1 },
    features: ['members', 'views', 'storage', 'guest'],
  },
  {
    id: 'business',
    priceMonthly: 24,
    limits: { members: -1, storageGb: 1024, projects: -1 },
    features: ['members', 'permissions', 'saml', 'storage'],
  },
]

/** The plan a subscription name maps to; anything unknown is the free plan. */
export function billingPlan(name: string | null | undefined): BillingPlan {
  return BILLING_PLANS.find(plan => plan.id === name) ?? BILLING_PLANS[0]!
}

/** The limit for one usage line, or `-1` (unlimited) when the plan has no cap. */
export function planLimit(plan: BillingPlan, key: keyof BillingPlanLimits): number {
  return plan.limits[key]
}

/** Percentage of a limit used, clamped to 100; `0` means "unlimited". */
export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}
