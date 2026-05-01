import type { H3Event } from 'h3'
import type { BusinessProfile } from '#layers/BaseDB/db/schema'
import type { GMBLocation } from '#layers/BaseDB/server/utils/googleMyBusiness'
import type {
  PaginatedResponse,
  QueryOptions,
  ServiceResponse
} from './types'
import { and, eq, not, sql } from 'drizzle-orm'
import { businessProfiles, entityDetails } from '#layers/BaseDB/db/schema'
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

export class BusinessProfileService {

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

      return { data: profile }
    } catch (error) {
      if (error instanceof ValidationError) {
        return { error: error.message, code: error.code }
      }
      return { error: 'Failed to create business profile' }
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

      if (profile) return { data: profile }

      // No direct owner match — fall back to org membership check if event is available.
      if (!event) {
        return { error: 'Business profile not found', code: 'NOT_FOUND' }
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
        return { error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      const orgMetadata = (entity.details ?? {}) as Record<string, unknown>
      const orgId = orgMetadata.organizationId as string | undefined
      if (!orgId) {
        return { error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      // useAuthApi is auto-imported globally by Nuxt from
      // packages/auth/server/utils/useAuthApi — no static import needed.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error Nuxt auto-imports composables from server/utils/
      // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-variables
      const authApi = (useAuthApi as (e: H3Event) => ReturnType<typeof useAuthApi>)(event)
      const org = await authApi.getFullOrganization({ query: { organizationId: orgId } }).catch(() => null)

      if (!org) {
        return { error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      const isMember = org.members.some((m: { userId: string }) => m.userId === userId)
      if (!isMember) {
        return { error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      const [profileFromOrg] = await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.id, id))
        .limit(1)

      if (!profileFromOrg) {
        return { error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      return { data: profileFromOrg }
    } catch (error) {
      return { error: 'Failed to fetch business profile' }
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
        return { error: 'Business profile not found', code: 'NOT_FOUND' }
      }

      return { data: profile }
    } catch (error) {
      return { error: 'Failed to fetch business profile' }
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
        data: profiles,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: count,
          totalPages: Math.ceil(count / (pagination.limit || 10))
        }
      }
    } catch (error) {
      return { error: 'Failed to fetch business profiles' }
    }
  }

  async findAll(userId: string): Promise<ServiceResponse<BusinessProfile[]>> {
    try {
      const profiles = await this.db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.userId, userId))

      return { data: profiles }
    } catch (error) {
      return { error: 'Failed to fetch business profiles' }
    }
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

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update business profile' }
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
      return { error: 'Failed to update business profile' }
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<void>> {
    try {
      // Check if profile exists and belongs to user
      const existingResult = await this.findById(id, userId)
      if (!existingResult) {
        return { error: "Business profile not found", code: "404" }
      }

      await this.db
        .delete(businessProfiles)
        .where(and(eq(businessProfiles.id, id), eq(businessProfiles.userId, userId)))

      return {}
    } catch (error) {
      return { error: 'Failed to delete business profile' }
    }
  }
  async setActive(userId: string, data: { id: string, isActive: boolean }): Promise<ServiceResponse<BusinessProfile>> {
    try {
      const existingResult = await this.findById(data.id, userId)
      if (!existingResult.data) {
        return existingResult
      }

      const [updated] = await this.db
        .update(businessProfiles)
        .set({
          isActive: data.isActive,
          updatedAt: dayjs.utc().toDate()
        })
        .where(and(eq(businessProfiles.id, data.id), eq(businessProfiles.userId, userId)))
        .returning()
      // Update all others to false
      await this.db
        .update(businessProfiles)
        .set({
          isActive: false,
          updatedAt: dayjs.utc().toDate()
        })
        .where(and(not(eq(businessProfiles.id, data.id)), eq(businessProfiles.userId, userId)))

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update business profile' }
    }
  }
  async getActive(userId: string): Promise<ServiceResponse<BusinessProfile>> {
    try {
      const existingResult = await this.findByUserId(userId)
      if (!existingResult.data) {
        return { error: 'No business profiles found', code: "404" }
      }

      const activeProfile = existingResult.data?.find(profile => profile.isActive)
      if (!activeProfile) {
        return { error: 'No active business profile found' }
      }

      return { data: activeProfile }
    } catch (error) {
      return { error: 'Failed to fetch active business profile' }
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

      return { data: syncedProfiles }
    } catch (error) {
      console.error('Error syncing GMB profiles:', error)
      return { error: 'Failed to sync business profiles from Google My Business' }
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
        return { error: 'Business profile not found', code: '404' }
      }

      if (!profile.googleBusinessId) {
        return { error: 'Business profile is not connected to Google My Business', code: 'NOT_CONNECTED' }
      }

      const gmbClient = createGMBClient(accessToken)
      const location = await gmbClient.getLocation(profile.googleBusinessId)

      return { data: location }
    } catch (error) {
      console.error('Error fetching GMB location details:', error)
      return { error: 'Failed to fetch Google My Business location details' }
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
        return { error: 'Business profile not found', code: '404' }
      }

      const isConnected = !!profile.googleBusinessId
      return { data: isConnected }
    } catch (error) {
      return { error: 'Failed to check GMB connection status' }
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
      return { error: 'Failed to disconnect from Google My Business' }
    }
  }
}

export const businessProfileService = new BusinessProfileService()
