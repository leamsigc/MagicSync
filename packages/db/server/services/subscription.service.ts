
import { and, eq, sql } from 'drizzle-orm'
import { subscriptions, type Subscription } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { ValidationError, UnauthorizedError, type ServiceResponse } from './types'
import type { SubscriptionServiceType } from './interfaces'

export interface CreateSubscriptionData {
  tier: 'trial' | 'basic' | 'normal' | 'gold' | 'god_mode'
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  trialEndsAt?: Date
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  stripeSubscriptionId?: string
}

export interface UpdateSubscriptionData {
  tier?: 'trial' | 'basic' | 'normal' | 'gold' | 'god_mode'
  status?: 'active' | 'cancelled' | 'past_due' | 'trialing'
  trialEndsAt?: Date
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  stripeSubscriptionId?: string
}

export interface SubscriptionLimits {
  maxBusinessProfiles: number
  maxSocialAccounts: number
  maxPostsPerMonth: number
  maxStorageGB: number
  hasAdvancedAnalytics: boolean
  hasCustomBranding: boolean
  hasPrioritySupport: boolean
}

export class SubscriptionService implements SubscriptionServiceType {
  private db = useDrizzle()

  async create(userId: string, data: CreateSubscriptionData): Promise<ServiceResponse<Subscription>> {
    try {
      this.validateCreateData(data)

      // Check if user already has an active subscription
      const existingResult = await this.findByUserId(userId)
      if (existingResult.data) {
        return { success: false, error: 'User already has a subscription', code: 'SUBSCRIPTION_EXISTS' }
      }

      const id = crypto.randomUUID()
      const now = new Date()

      const [subscription] = await this.db.insert(subscriptions).values({
        id,
        userId,
        ...data,
        createdAt: now,
        updatedAt: now
      }).returning()

      return { success: true, data: subscription }
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message, code: error.code }
      }
      return { success: false, error: 'Failed to create subscription' }
    }
  }

  async findById(id: string, userId: string): Promise<ServiceResponse<Subscription>> {
    try {
      const [subscription] = await this.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .limit(1)

      if (!subscription) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      // Ownership check
      if (subscription.userId !== userId) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }
      }

      return { success: true, data: subscription }
    } catch (error) {
      return { success: false, error: 'Failed to fetch subscription' }
    }
  }

  async findByUserId(userId: string): Promise<ServiceResponse<Subscription>> {
    try {
      const [subscription] = await this.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1)

      if (!subscription) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: subscription }
    } catch (error) {
      return { success: false, error: 'Failed to fetch subscription' }
    }
  }

  async findByStripeId(stripeSubscriptionId: string): Promise<ServiceResponse<Subscription>> {
    try {
      const [subscription] = await this.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .limit(1)

      if (!subscription) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: subscription }
    } catch (error) {
      return { success: false, error: 'Failed to fetch subscription' }
    }
  }

  async update(id: string, userId: string, data: UpdateSubscriptionData): Promise<ServiceResponse<Subscription>> {
    try {
      // Fetch subscription first to verify ownership
      const existingResult = await this.findById(id, userId)
      if (existingResult.error || !existingResult.data) {
        return { success: false, error: existingResult.error || 'Subscription not found', code: 'NOT_FOUND' }
      }

      // Ownership check
      if (existingResult.data.userId !== userId) {
        return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }
      }

      const [updated] = await this.db
        .update(subscriptions)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, id))
        .returning()

      if (!updated) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to update subscription' }
    }
  }

  async updateByUserId(userId: string, data: UpdateSubscriptionData): Promise<ServiceResponse<Subscription>> {
    try {
      // Fetch subscription first to verify ownership
      const existingResult = await this.findByUserId(userId)
      if (existingResult.error && existingResult.code !== 'NOT_FOUND') {
        return existingResult
      }

      if (!existingResult.data) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      const [updated] = await this.db
        .update(subscriptions)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.userId, userId))
        .returning()

      if (!updated) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to update subscription' }
    }
  }

  async cancel(userId: string): Promise<ServiceResponse<Subscription>> {
    try {
      // Fetch subscription first to verify ownership
      const existingResult = await this.findByUserId(userId)
      if (existingResult.error && existingResult.code !== 'NOT_FOUND') {
        return existingResult
      }

      if (!existingResult.data) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      const [updated] = await this.db
        .update(subscriptions)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.userId, userId))
        .returning()

      if (!updated) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to cancel subscription' }
    }
  }

  async reactivate(userId: string): Promise<ServiceResponse<Subscription>> {
    try {
      // Fetch subscription first to verify ownership
      const existingResult = await this.findByUserId(userId)
      if (existingResult.error && existingResult.code !== 'NOT_FOUND') {
        return existingResult
      }

      if (!existingResult.data) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      const [updated] = await this.db
        .update(subscriptions)
        .set({
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(subscriptions.userId, userId))
        .returning()

      if (!updated) {
        return { success: false, error: 'Subscription not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to reactivate subscription' }
    }
  }

  async getExpiringSoon(daysThreshold: number = 7): Promise<ServiceResponse<Subscription[]>> {
    try {
      const thresholdDate = new Date()
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold)

      const expiring = await this.db
        .select()
        .from(subscriptions)
        .where(and(
          eq(subscriptions.status, 'active'),
          sql`${subscriptions.currentPeriodEnd} <= ${thresholdDate.getTime()}`
        ))

      return { success: true, data: expiring }
    } catch (error) {
      return { success: false, error: 'Failed to fetch expiring subscriptions' }
    }
  }

  async getTrialsEndingSoon(daysThreshold: number = 3): Promise<ServiceResponse<Subscription[]>> {
    try {
      const thresholdDate = new Date()
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold)

      const expiring = await this.db
        .select()
        .from(subscriptions)
        .where(and(
          eq(subscriptions.status, 'trialing'),
          sql`${subscriptions.trialEndsAt} <= ${thresholdDate.getTime()}`
        ))

      return { success: true, data: expiring }
    } catch (error) {
      return { success: false, error: 'Failed to fetch expiring trials' }
    }
  }

  getLimits(tier: string): SubscriptionLimits {
    const limits: Record<string, SubscriptionLimits> = {
      trial: {
        maxBusinessProfiles: 1,
        maxSocialAccounts: 2,
        maxPostsPerMonth: 10,
        maxStorageGB: 1,
        hasAdvancedAnalytics: false,
        hasCustomBranding: false,
        hasPrioritySupport: false
      },
      basic: {
        maxBusinessProfiles: 1,
        maxSocialAccounts: 5,
        maxPostsPerMonth: 50,
        maxStorageGB: 5,
        hasAdvancedAnalytics: false,
        hasCustomBranding: false,
        hasPrioritySupport: false
      },
      normal: {
        maxBusinessProfiles: 3,
        maxSocialAccounts: 10,
        maxPostsPerMonth: 200,
        maxStorageGB: 20,
        hasAdvancedAnalytics: true,
        hasCustomBranding: false,
        hasPrioritySupport: false
      },
      gold: {
        maxBusinessProfiles: 10,
        maxSocialAccounts: 25,
        maxPostsPerMonth: 1000,
        maxStorageGB: 100,
        hasAdvancedAnalytics: true,
        hasCustomBranding: true,
        hasPrioritySupport: true
      },
      god_mode: {
        maxBusinessProfiles: -1, // Unlimited
        maxSocialAccounts: -1, // Unlimited
        maxPostsPerMonth: -1, // Unlimited
        maxStorageGB: -1, // Unlimited
        hasAdvancedAnalytics: true,
        hasCustomBranding: true,
        hasPrioritySupport: true
      }
    }

    return limits[tier] || limits.trial as SubscriptionLimits
  }

  async checkLimit(userId: string, limitType: keyof SubscriptionLimits): Promise<ServiceResponse<{ allowed: boolean, current: number, limit: number }>> {
    try {
      const subscriptionResult = await this.findByUserId(userId)
      if (!subscriptionResult.data) {
        // Default to trial limits if no subscription found
        const limits = this.getLimits('trial')
        return {
          success: true,
          data: {
            allowed: false,
            current: 0,
            limit: limits[limitType] as number
          }
        }
      }

      const limits = this.getLimits(subscriptionResult.data.tier)
      const limit = limits[limitType] as number

      // If limit is -1, it's unlimited
      if (limit === -1) {
        return {
          success: true,
          data: {
            allowed: true,
            current: 0,
            limit: -1
          }
        }
      }

      // For boolean limits, just return the value
      if (typeof limits[limitType] === 'boolean') {
        return {
          success: true,
          data: {
            allowed: limits[limitType] as boolean,
            current: 0,
            limit: 1
          }
        }
      }

      // TODO: Implement actual usage counting based on limitType
      // This would require querying the relevant tables to get current usage
      const current = 0 // Placeholder

      return {
        data: {
          allowed: current < limit,
          current,
          limit
        }
      }
    } catch (error) {
      return { success: false, error: 'Failed to check subscription limit' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<void>> {
    try {
      // Fetch subscription first to verify ownership
      const existingResult = await this.findById(id, userId)
      if (existingResult.error || !existingResult.data) {
        return { success: false, error: existingResult.error || 'Subscription not found', code: existingResult.code || 'NOT_FOUND' }
      }

      await this.db
        .delete(subscriptions)
        .where(eq(subscriptions.id, id))

      return {}
    } catch (error) {
      return { success: false, error: 'Failed to delete subscription' }
    }
  }

  private validateCreateData(data: CreateSubscriptionData): void {
    const validTiers = ['trial', 'basic', 'normal', 'gold', 'god_mode']
    if (!validTiers.includes(data.tier)) {
      throw new ValidationError('Invalid subscription tier', 'tier')
    }

    const validStatuses = ['active', 'cancelled', 'past_due', 'trialing']
    if (!validStatuses.includes(data.status)) {
      throw new ValidationError('Invalid subscription status', 'status')
    }

    if (data.status === 'trialing' && !data.trialEndsAt) {
      throw new ValidationError('Trial end date is required for trialing subscriptions', 'trialEndsAt')
    }

    if (data.currentPeriodStart && data.currentPeriodEnd && data.currentPeriodStart >= data.currentPeriodEnd) {
      throw new ValidationError('Current period start must be before current period end', 'currentPeriodStart')
    }
  }
}

export const subscriptionService = new SubscriptionService()
