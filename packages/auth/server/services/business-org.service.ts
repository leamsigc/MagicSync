import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { businessProfiles, organization as organizationTable } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { auth } from '#layers/BaseAuth/lib/auth'
import { useAuthApi, type AuthApi } from '../utils/useAuthApi'
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

const db = useDrizzle()

export type OrgDetails = Awaited<ReturnType<AuthApi['getFullOrganization']>>

/** Check if a thrown error is a better-auth ORGANIZATION_ALREADY_EXISTS. */
function isOrgAlreadyExistsError(err: unknown): boolean {
  const e = err as Record<string, unknown> | undefined
  if (!e) return false
  // Handles both: err.body?.code === 'ORGANIZATION_ALREADY_EXISTS' and
  // err.code === 'ORGANIZATION_ALREADY_EXISTS' (wrapped in fetch)
  const code = (e.body as Record<string, unknown> | undefined)?.code ?? e.code
  return code === 'ORGANIZATION_ALREADY_EXISTS'
}

export const businessOrgService = {
  /**
   * Get or create an organization for a business, returning the full org object.
   * Headers are extracted automatically from the event — no manual passing needed.
   *
   * Race-condition-safe: if two requests both try to create the org with the
   * same slug simultaneously, the second one catches ORGANIZATION_ALREADY_EXISTS
   * and fetches the already-created org instead of failing.
   *
   * @returns The full org object including members — the caller can check
   *          membership with isUserMemberOfOrg() without any extra API call.
   */
  async getOrCreateOrgForBusiness(event: H3Event, businessId: string): Promise<OrgDetails> {
    const authApi = useAuthApi(event)
    const { data: businessDetails } = await businessProfileService.findByIdOnly(businessId)
    const business = await entityDetailsService.getDetailsByEntity(businessId, 'business_details')

    if (!business) {
      throw createError({ statusCode: 404, statusMessage: 'Business not found' })
    }

    const orgMetadata = (business.details ?? {}) as Record<string, unknown>
    const orgId = orgMetadata.organizationId as string | undefined

    if (orgId) {
      const existingOrg = await authApi.getFullOrganization({
        query: { organizationId: orgId }
      }).catch(() => null)

      if (existingOrg) return existingOrg
    }

    const slug = `biz-${businessId.slice(0, 8)}`

    let org: OrgDetails
    try {
      org = await authApi.createOrganization({
        body: {
          name: businessDetails?.name || 'DEFAULT',
          slug,
          metadata: { businessId: businessDetails?.id }
        }
      })
    }
    catch (err: unknown) {
      // Idempotent path: org was already created by a concurrent request.
      if (isOrgAlreadyExistsError(err)) {
        const existing = await authApi.getFullOrganization({ query: { organizationId: slug } })
        if (existing) {
          // Persist the orgId so future calls skip the slug-based lookup.
          await entityDetailsService.updateDetails(business.id, {
            details: { ...orgMetadata, organizationId: existing.id }
          })
          org = existing
        }
        else {
          throw err
        }
      }
      else {
        throw err
      }
    }

    // Persist the resolved orgId on first creation.
    await entityDetailsService.updateDetails(business.id, {
      details: { ...orgMetadata, organizationId: org.id }
    })

    return org
  },

  /**
   * Look up a business ID from an organization's metadata.
   * This call does not need session headers — it reads public org metadata.
   */
  async getBusinessIdFromOrg(orgId: string): Promise<string | null> {
    const db = useDrizzle()
    const org = await db
      .select()
      .from(organizationTable)
      .where(eq(organizationTable.id, orgId))
      .get()
    const metadata = JSON.parse(org?.metadata ?? {}) as Record<string, unknown>
    return metadata.businessId as string
  },

  /**
   * Check if a user is a member of an organization by inspecting the org's members list.
   * No additional API calls — pass the org object returned by getOrCreateOrgForBusiness().
   */
  isUserMemberOfOrg(org: OrgDetails, userId: string): boolean {
    return !!org.members.find((m: { userId: string }) => m.userId === userId)
  },

  /**
   * Check if a business is active.
   */
  async isBusinessActive(businessId: string): Promise<boolean> {
    const business = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId))
      .get()
    return business?.isActive ?? false
  },

  /**
   * Read-only: get the org for a business (if one exists).
   * Returns null if no org is linked to this business yet.
   * Does NOT create anything — use getOrCreateOrgForBusiness() for write operations.
   */
  async getOrgForBusiness(event: H3Event, businessId: string): Promise<OrgDetails | null> {
    const authApi = useAuthApi(event)
    const entity = await entityDetailsService.getDetailsByEntity(businessId, 'business_details')
    if (!entity) return null

    const orgMetadata = (entity.details ?? {}) as Record<string, unknown>
    const orgId = orgMetadata.organizationId as string | undefined
    if (!orgId) return null

    return authApi.getFullOrganization({ query: { organizationId: orgId } }).catch(() => null)
  }
}
