import type { H3Event } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import { businessProfiles, entityDetails, member, organization } from '#layers/BaseDB/db/schema'
import { coerceJsonObject } from '#layers/BaseShared/utils/json'
import type { ServiceResponse } from './types'
import { useDrizzle } from '../utils/drizzle'

export type BusinessRole = 'owner' | 'member'

export interface BusinessAccess {
  business: BusinessProfile
  role: BusinessRole
  /** User ID that owns shared business rows (corpus, playbook editions, posts). */
  ownerUserId: string
}

function isOwnerRole(role: string | null | undefined): boolean {
  return role === 'owner'
}

async function resolveInvitedRole(userId: string, businessId: string): Promise<BusinessRole | null> {
  const db = useDrizzle()

  const entity = await db
    .select({ details: entityDetails.details })
    .from(entityDetails)
    .where(and(
      eq(entityDetails.entityId, businessId),
      eq(entityDetails.entityType, 'business_details'),
    ))
    .get()

  if (!entity) return null

  const organizationId = coerceJsonObject(entity.details).organizationId
  if (typeof organizationId !== 'string' || organizationId.length === 0) return null

  const membership = await db
    .select({ role: member.role })
    .from(member)
    .where(and(
      eq(member.organizationId, organizationId),
      eq(member.userId, userId),
    ))
    .get()

  if (!membership) return null

  return isOwnerRole(membership.role) ? 'owner' : 'member'
}

type AccessCache = Map<string, BusinessAccess | null>

function accessCacheFor(event?: H3Event): AccessCache | null {
  if (!event?.context) return null
  const context = event.context as { businessAccessCache?: AccessCache }
  context.businessAccessCache ??= new Map()
  return context.businessAccessCache
}

/**
 * Resolve owner-or-member access to a business and the owner ID used to scope
 * shared rows. Never throws — returns a ServiceResponse.
 */
export const businessAccessService = {
  async resolve(
    userId: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<BusinessAccess>> {
    const cache = accessCacheFor(event)
    const cacheKey = `${userId}:${businessId}`
    const cached = cache?.get(cacheKey)
    if (cached !== undefined) {
      return cached
        ? { success: true, data: cached }
        : { success: false, error: 'Business not found', code: 'NOT_FOUND' }
    }

    try {
      const db = useDrizzle()
      const business = await db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.id, businessId))
        .get()

      if (!business) {
        cache?.set(cacheKey, null)
        return { success: false, error: 'Business not found', code: 'NOT_FOUND' }
      }

      const role = business.userId === userId
        ? 'owner'
        : await resolveInvitedRole(userId, businessId)

      if (!role) {
        cache?.set(cacheKey, null)
        return { success: false, error: 'Business not found', code: 'NOT_FOUND' }
      }

      const access: BusinessAccess = {
        business,
        role,
        ownerUserId: business.userId,
      }
      cache?.set(cacheKey, access)
      return { success: true, data: access }
    }
    catch {
      return { success: false, error: 'Failed to verify business access' }
    }
  },

  /** Convenience wrapper for call sites that already resolved access. */
  async isMember(userId: string, businessId: string, event?: H3Event): Promise<boolean> {
    const access = await this.resolve(userId, businessId, event)
    return access.success && !!access.data
  },

  async isOwner(userId: string, businessId: string, event?: H3Event): Promise<boolean> {
    const access = await this.resolve(userId, businessId, event)
    return access.success && access.data?.role === 'owner'
  },

  /** Business creator id, used to re-key background work to the shared owner. */
  async getOwnerUserId(businessId: string): Promise<string | null> {
    const db = useDrizzle()
    const row = await db
      .select({ userId: businessProfiles.userId })
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId))
      .get()
    return row?.userId ?? null
  },

/**
   * Every business the user can read: owned plus org-membership businesses.
   * Used by list queries that need an `IN (...)` predicate instead of a
   * per-business access check.
   */
  async listAccessibleBusinessIds(userId: string): Promise<string[]> {
    const db = useDrizzle()
    const owned = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
    const ids = new Set(owned.map(row => row.id))

    const memberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
    if (memberships.length === 0) return [...ids]

    const orgIds = memberships.map(entry => entry.organizationId)
    const orgs = await db
      .select({ id: organization.id, metadata: organization.metadata })
      .from(organization)
      .where(inArray(organization.id, orgIds))

    for (const org of orgs) {
      const businessId = coerceJsonObject(org.metadata).businessId
      if (typeof businessId === 'string' && businessId) ids.add(businessId)
    }

    return [...ids]
  },
}
