/**
 * Who may use the app, and why.
 *
 * Two rules, resolved on the server and never from anything the client sends:
 *
 * 1. **Admins never pay.** An `admin` is entitled regardless of subscription or
 *    trial.
 * 2. **Every other new account gets a free trial** of `TRIAL_DAYS` days, counted
 *    from the account's `createdAt`. Paying is what continues access after it
 *    ends.
 *
 * A paid subscription always wins over the trial (so someone who subscribes on
 * day 2 is `active`, not `trial`).
 *
 * `enforce` is the deployment's switch: with it off the app shows the state but
 * never blocks, so existing accounts are never locked out by adding billing.
 */
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'

/** Days of free access a new (non-admin) account starts with. */
export const TRIAL_DAYS = 10

const DAY_MS = 86_400_000

export type AccessState = 'admin' | 'active' | 'trialing' | 'trial' | 'expired'

export interface AccessSummary {
  state: AccessState
  /** Whether the app may be used at all. */
  allowed: boolean
  /** ISO date the free trial ends, or `null` when the account predates it. */
  trialEndsAt: string | null
  /** Whole days of trial left; `0` once it has ended. */
  daysLeft: number
  /** Whether this deployment blocks access when `allowed` is false. */
  enforce: boolean
}

/** The subset of the user row this decision needs. */
export interface AccessSubject {
  role?: string | null
  createdAt?: Date | string | null
}

/** The subset of a subscription this decision needs. */
export interface AccessSubscription {
  status?: string | null
}

/** The deployment switch. Read once, server-side, from the environment. */
export function accessEnforced(): boolean {
  return process.env.BILLING_ENFORCE_ACCESS === 'true'
}

/** When a trial started for this account, or `null` when `createdAt` is unusable. */
export function trialEndsAt(createdAt: Date | string | null | undefined): Date | null {
  if (!createdAt) return null
  const start = new Date(createdAt)
  if (Number.isNaN(start.getTime())) return null
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS)
}

/** Whole days remaining until `endsAt`; never negative. */
export function daysUntil(endsAt: Date | null, now: Date): number {
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS))
}

/**
 * The one place access is decided. Pure: same inputs, same answer, so it can be
 * called from any route without a database round trip of its own.
 */
export function resolveAccess(
  subject: AccessSubject,
  subscription: AccessSubscription | null | undefined,
  now: Date = new Date(),
): AccessSummary {
  const endsAt = trialEndsAt(subject.createdAt)
  const base = {
    trialEndsAt: endsAt ? endsAt.toISOString() : null,
    daysLeft: daysUntil(endsAt, now),
    enforce: accessEnforced(),
  }
  if (subject.role === 'admin') return { ...base, state: 'admin', allowed: true }
  if (subscription?.status === 'active') return { ...base, state: 'active', allowed: true }
  if (subscription?.status === 'trialing') return { ...base, state: 'trialing', allowed: true }
  if (base.daysLeft > 0) return { ...base, state: 'trial', allowed: true }
  return { ...base, state: 'expired', allowed: false }
}

/** Convenience wrapper so callers keep the `ServiceResponse` shape. */
export function accessResponse(summary: AccessSummary): ServiceResponse<AccessSummary> {
  return { success: true, data: summary }
}
