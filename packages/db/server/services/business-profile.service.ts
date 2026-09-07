import type { H3Event } from 'h3'
import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import type { GMBLocation } from '#layers/BaseDB/server/utils/googleMyBusiness'
import type {
  PaginatedResponse,
  QueryOptions,
  ServiceResponse
} from './types'
import type { BusinessProfileServiceType } from './interfaces'
import { and, eq, inArray, not, sql } from 'drizzle-orm'
import { businessProfiles, entityDetails, member, organization } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import {
  createGMBClient,
  formatLocationForStorage

} from '#layers/BaseDB/server/utils/googleMyBusiness'
import {
  ValidationError
} from './types'

export interface CreateBusinessProfileData {
  name: string
  description?: string
  address?: string
  phone?: string
  website?: string
  category?: string
  googleBusinessId?: string
}

export interface UpdateBusinessProfileData extends Partial<CreateBusinessProfileData> {
  isActive?: boolean
}

export class BusinessProfileService implements BusinessProfileServiceType {

  private db = useDrizzle()

  async create(userId: string, data: CreateBusinessProfileData): Promise<ServiceResponse<BusinessProfile>> {
    try {
      this.validateCreateData(data)

      const id = crypto.randomUUID()
      const now = dayjs.utc().toDate()

      const [profile] = await this.db.insert(businessProfiles).values({
        id,
        userId,
        ...data,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }).returning()

      return { success: true, data: profile }
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, error: error.message, code: error.code }
      }
      return { success: false, error: 'Failed to create business profile' }
    }
  }

  /**
   * Find a business profile by ID.
   *
   * Access is granted if the user is either:
   * 1. The direct owner (businessProfiles.userId === userId), OR
   * 2. A member of the business's organization (via better-auth org membership).
   *
   * The org membership check is skipped when `event` is omitted (e.g. internal calls).
   * When `event` is provided, it uses `useAuthApi` (auto-imported by Nuxt from
   * `#layers/BaseAuth/server/utils/useAuthApi`) to look up the org members list.
   */
  async findById(
    id: string,
    userId: string,
    event?: H3Event
  ): Promise<ServiceResponse<BusinessProfile>> {
    try {
      const [profile] = await this.db
        .select()
        .from(businessProfiles)
        .where(and(eq(businessProfiles.id, id), eq(businessProfiles.userId, userId)))
        .limit(1)

      if (profile) return { success: true, data: profile }

      // No direct owner match — fall back to org membership check if event is available.
      if (!event) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      const entity = await this.db
        .select()
        .from(entityDetails)
        .where(and(
          eq(entityDetails.entityId, id),
          eq(entityDetails.entityType, 'business_details')
        ))
        .get()

      if (!entity) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      const orgMetadata = (entity.details ?? {}) as Record<string, unknown>
      const orgId = orgMetadata.organizationId as string | undefined
      if (!orgId) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      // useAuthApi is auto-imported globally by Nuxt from
      // packages/auth/server/utils/useAuthApi — no static import needed.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error Nuxt auto-imports composables from server/utils/
      // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-variables
      const authApi = (useAuthApi as (e: H3Event) => ReturnType<typeof useAuthApi>)(event)
      const org = await authApi.getFullOrganization({ query: { organizationId: orgId } }).catch(() => null)

      if (!org) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      const isMember = org.members.some((m: { userId: string }) => m.userId === userId)
      if (!isMember) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      const [profileFromOrg] = await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.id, id))
        .limit(1)

      if (!profileFromOrg) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: profileFromOrg }
    } catch (error) {
      return { success: false, error: 'Failed to fetch business profile' }
    }
  }
  async findByIdOnly(id: string,): Promise<ServiceResponse<BusinessProfile>> {
    try {
      const [profile] = await this.db
        .select()
        .from(businessProfiles)
        .where(and(eq(businessProfiles.id, id)))
        .limit(1)

      if (!profile) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: profile }
    } catch (error) {
      return { success: false, error: 'Failed to fetch business profile' }
    }
  }

  async findByUserId(userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<BusinessProfile>> {
    try {
      const { pagination = { page: 1, limit: 10 } } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 10)

      const profiles = await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, userId))
        .limit(pagination.limit || 10)
        .offset(offset)

      // Get total count for pagination
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, userId))

      const count = result[0]?.count ?? 0;

      return {
        success: true,
        data: profiles,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 10))
        }
      }
    } catch (error) {
      return { success: false, error: 'Failed to fetch business profiles' }
    }
  }

  async findAll(userId: string): Promise<ServiceResponse<BusinessProfile[]>> {
    try {
      const profiles = await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, userId))

      return { success: true, data: profiles }
    } catch (error) {
      return { success: false, error: 'Failed to fetch business profiles' }
    }
  }

  /**
   * Find all businesses for a user including those where they are org members.
   * Used for listing businesses in the UI - invited members should see the business.
   */
  async findByUserIdWithMembership(userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<BusinessProfile>> {
    try {
      const { pagination = { page: 1, limit: 10 } } = options
      const offset = ((pagination.page || 1) - 1) * (pagination.limit || 10)

      // Owned businesses
      const owned = await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, userId))

      // Member via organization: member -> organization -> metadata.businessId
      const memberships = await this.db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, userId))

      const orgIds = memberships.map(m => m.organizationId)
      let memberBusinessIds: string[] = []
      if (orgIds.length) {
        const orgs = await this.db
          .select({ id: organization.id, metadata: organization.metadata })
          .from(organization)
          .where(inArray(organization.id, orgIds))
        memberBusinessIds = orgs
          .map(o => {
            try {
              const meta = JSON.parse(o.metadata || '{}') as Record<string, unknown>
              return meta.businessId as string | undefined
            } catch { return undefined }
          })
          .filter((id): id is string => !!id)
      }

      // Deduplicate and fetch member businesses not already owned
      const ownedIds = new Set(owned.map(b => b.id))
      const memberOnlyIds = memberBusinessIds.filter(id => !ownedIds.has(id))
      let memberBusinesses: BusinessProfile[] = []
      if (memberOnlyIds.length) {
        memberBusinesses = await this.db
          .select()
          .from(businessProfiles)
          .where(inArray(businessProfiles.id, memberOnlyIds))
      }

      const all = [...owned, ...memberBusinesses]
      // Simple pagination on combined array (owned + member, small numbers)
      const paginated = all.slice(offset, offset + (pagination.limit || 10))

      return {
        success: true,
        data: paginated,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: all.length,
          totalPages: Math.ceil(all.length / (pagination.limit || 10))
        }
      }
    } catch (error) {
      return { success: false, error: 'Failed to fetch business profiles' } as PaginatedResponse<BusinessProfile>
    }
  }

  async findAllWithMembership(userId: string): Promise<ServiceResponse<BusinessProfile[]>> {
    const res = await this.findByUserIdWithMembership(userId, { pagination: { page: 1, limit: 100 } })
    if (!res.success) return { success: false, error: res.error }
    return { success: true, data: res.data ?? [] }
  }

  async update(id: string, userId: string, data: UpdateBusinessProfileData): Promise<ServiceResponse<BusinessProfile>> {
    try {
      // Check if profile exists and belongs to user
      const existingResult = await this.findById(id, userId)
      if (!existingResult) {
        return existingResult
      }

      const [updated] = await this.db
        .update(businessProfiles)
        .set({
          ...data,
          updatedAt: dayjs.utc().toDate()
        })
        .where(and(eq(businessProfiles.id, id), eq(businessProfiles.userId, userId)))
        .returning()

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to update business profile' }
    }
  }

  /**
   * Like update() but skips the findById ownership check.
   * Use only when the caller already verified ownership.
   */
  async updateRaw(id: string, data: UpdateBusinessProfileData): Promise<ServiceResponse<BusinessProfile>> {
    try {
      const [updated] = await this.db
        .update(businessProfiles)
        .set({ ...data, updatedAt: dayjs.utc().toDate() })
        .where(eq(businessProfiles.id, id))
        .returning()

      return updated ? { data: updated } : { error: 'Business profile not found', code: '404' }
    } catch (error) {
      return { success: false, error: 'Failed to update business profile' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<void>> {
    try {
      // Check if profile exists and belongs to user
      const existingResult = await this.findById(id, userId)
      if (!existingResult) {
        return { success: false, error: "Business profile not found", code: "404" }
      }

      await this.db
        .delete(businessProfiles)
        .where(and(eq(businessProfiles.id, id), eq(businessProfiles.userId, userId)))

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to delete business profile' }
    }
  }

  /**
   * Like delete() but skips the findById ownership check.
   * Use only for admin operations where the caller already verified authorization.
   */
  async deleteRaw(id: string): Promise<ServiceResponse<void>> {
    try {
      const result = await this.db
        .delete(businessProfiles)
        .where(eq(businessProfiles.id, id))
        .returning()

      if (!result.length) {
        return { success: false, error: "Business profile not found", code: "404" }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Failed to delete business profile' }
    }
  }
  async setActive(userId: string, data: { id: string, isActive: boolean }, event?: H3Event): Promise<ServiceResponse<BusinessProfile>> {
    try {
      const existingResult = await this.findById(data.id, userId, event)
      if (!existingResult.data) {
        return existingResult
      }

      const business = existingResult.data
      const isOwner = business.userId === userId

      // For members (not owner), don't update global isActive - just return business as active for this user session
      // Client manages activeBusinessId via useState, DB isActive is per-business not per-user
      if (!isOwner) {
        return { success: true, data: { ...business, isActive: true } as BusinessProfile }
      }

      const [updated] = await this.db
        .update(businessProfiles)
        .set({
          isActive: data.isActive,
          updatedAt: dayjs.utc().toDate()
        })
        .where(and(eq(businessProfiles.id, data.id), eq(businessProfiles.userId, userId)))
        .returning()
      // Update all others to false (only for owned businesses)
      await this.db
        .update(businessProfiles)
        .set({
          isActive: false,
          updatedAt: dayjs.utc().toDate()
        })
        .where(and(not(eq(businessProfiles.id, data.id)), eq(businessProfiles.userId, userId)))

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to update business profile' }
    }
  }
  async getActive(userId: string): Promise<ServiceResponse<BusinessProfile>> {
    try {
      const existingResult = await this.findByUserId(userId)
      if (!existingResult.data) {
        return { success: false, error: 'No business profiles found', code: "404" }
      }

      const activeProfile = existingResult.data?.find(profile => profile.isActive)
      if (!activeProfile) {
        return { success: false, error: 'No active business profile found' }
      }

      return { success: true, data: activeProfile }
    } catch (error) {
      return { success: false, error: 'Failed to fetch active business profile' }
    }
  }

  private validateCreateData(data: CreateBusinessProfileData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Business name is required', 'name')
    }

    if (data.name.length > 255) {
      throw new ValidationError('Business name must be less than 255 characters', 'name')
    }

    if (data.website && !this.isValidUrl(data.website)) {
      throw new ValidationError('Invalid website URL', 'website')
    }

    if (data.phone && !this.isValidPhone(data.phone)) {
      throw new ValidationError('Invalid phone number format', 'phone')
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      // websites can be with out the https://
      url = url.startsWith('https://') ? url : `https://${url}`
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private isValidPhone(phone: string): boolean {
    // Basic phone validation - can be enhanced based on requirements
    const phoneRegex = /^\+?[1-9]\d{0,15}$/
    return phoneRegex.test(phone.replace(/[\s\-()]/g, ''))
  }

  /**
   * Fetch and synchronize business profiles from Google My Business
   */
  async syncFromGMB(userId: string, accessToken: string): Promise<ServiceResponse<BusinessProfile[]>> {
    try {
      const gmbClient = createGMBClient(accessToken)

      // Get all GMB accounts
      const accounts = await gmbClient.getAccounts()
      const syncedProfiles: BusinessProfile[] = []

      for (const account of accounts) {
        // Get locations for each account
        const locations = await gmbClient.getLocations(account.name)

        for (const location of locations) {
          const formattedData = formatLocationForStorage(location)

          // Check if business already exists
          const [existingProfile] = await this.db
            .select()
            .from(businessProfiles)
            .where(and(
              eq(businessProfiles.userId, userId),
              eq(businessProfiles.googleBusinessId, formattedData.googleBusinessId)
            ))
            .limit(1)

          if (existingProfile) {
            // Update existing profile
            const updateResult = await this.update(existingProfile.id, userId, formattedData)
            if (updateResult.data) {
              syncedProfiles.push(updateResult.data!)
            }
          } else {
            // Create new profile
            const createResult = await this.create(userId, formattedData)
            if (createResult.data) {
              syncedProfiles.push(createResult.data!)
            }
          }
        }
      }

      return { success: true, data: syncedProfiles }
    } catch (error) {
      console.error('Error syncing GMB profiles:', error)
      return { success: false, error: 'Failed to sync business profiles from Google My Business' }
    }
  }

  /**
   * Get GMB location details for a business profile.
   *
   * @param business  Optional pre-fetched business. If provided, skips the internal findById call.
   */
  async getGMBLocationDetails(
    businessId: string,
    userId: string,
    accessToken: string,
    business?: BusinessProfile
  ): Promise<ServiceResponse<GMBLocation>> {
    try {
      const profile = business ?? (await this.findById(businessId, userId))?.data
      if (!profile) {
        return { success: false, error: 'Business profile not found', code: '404' }
      }

      if (!profile.googleBusinessId) {
        return { success: false, error: 'Business profile is not connected to Google My Business', code: 'NOT_CONNECTED' }
      }

      const gmbClient = createGMBClient(accessToken)
      const location = await gmbClient.getLocation(profile.googleBusinessId)

      return { success: true, data: location }
    } catch (error) {
      console.error('Error fetching GMB location details:', error)
      return { success: false, error: 'Failed to fetch Google My Business location details' }
    }
  }

  /**
   * Check if a business profile is connected to Google My Business.
   *
   * @param business  Optional pre-fetched business. If provided, skips the internal findById call.
   */
  async isConnectedToGMB(
    businessId: string,
    userId: string,
    business?: BusinessProfile
  ): Promise<ServiceResponse<boolean>> {
    try {
      const profile = business ?? (await this.findById(businessId, userId))?.data
      if (!profile) {
        return { success: false, error: 'Business profile not found', code: '404' }
      }

      const isConnected = !!profile.googleBusinessId
      return { success: true, data: isConnected }
    } catch (error) {
      return { success: false, error: 'Failed to check GMB connection status' }
    }
  }

  /**
   * Disconnect a business profile from Google My Business.
   *
   * @param business  Optional pre-fetched business. If provided, skips the internal findById call.
   */
  async disconnectFromGMB(
    businessId: string,
    userId: string,
    business?: BusinessProfile
  ): Promise<ServiceResponse<BusinessProfile>> {
    try {
      // Reuse the business if passed; otherwise update() will verify ownership.
      const updateResult = business
        ? await this.updateRaw(businessId, { googleBusinessId: undefined })
        : await this.update(businessId, userId, { googleBusinessId: undefined })

      return updateResult
    } catch (error) {
      return { success: false, error: 'Failed to disconnect from Google My Business' }
    }
  }
}

export const businessProfileService = new BusinessProfileService()
