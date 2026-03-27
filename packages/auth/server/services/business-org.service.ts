import { eq } from 'drizzle-orm'
import { businessProfiles } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { auth } from '#layers/BaseAuth/lib/auth'

const db = useDrizzle()
export const businessOrgService = {
  async getOrCreateOrgForBusiness(businessId: string): Promise<string> {

    const business = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId))
      .get()
      if (!business) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Business not found'
        })
      }

      const orgMetadata = business.metadata as Record<string, unknown> | undefined
      const orgId = orgMetadata?.organizationId as string | undefined

      if (orgId) {
        const existingOrg = await auth.api.getFullOrganization({
          query: { organizationId: orgId },
          headers: new Headers()
        }).catch(() => null)

        if (existingOrg) {
          return orgId
        }
      }

      console.log("##########BEFORE #######",{})
      const org = await auth.api.createOrganization({
        body: {
          name: business.name  ,
          slug: `biz-${business.id.slice(0, 8)}`,
          metadata: {
            businessId: business.id
          }
        },
        headers: new Headers()
      })
      console.log({org})

    await db
      .update(businessProfiles)
      .set({
        metadata: {
          ...orgMetadata,
          organizationId: org.id
        }
      })
      .where(eq(businessProfiles.id, businessId))

    return org.id
  },

  async getBusinessIdFromOrg(orgId: string): Promise<string | null> {
    const db = useDrizzle()

    const org = await auth.api.getFullOrganization({
      query: { organizationId: orgId },
      headers: new Headers()
    }).catch(() => null)

    if (!org?.metadata?.businessId) {
      return null
    }

    return org.metadata.businessId as string
  },

  async isBusinessActive(businessId: string): Promise<boolean> {
    const db = useDrizzle()

    const business = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId))
      .get()

    return business?.isActive ?? false
  },

  async isUserMemberOfBusinessOrg(userId: string, businessId: string): Promise<boolean> {
    const orgId = await this.getOrCreateOrgForBusiness(businessId)

    const org = await auth.api.getFullOrganization({
      query: { organizationId: orgId },
      headers: new Headers()
    })

    const member = org.members.find((m: { userId: string }) => m.userId === userId)
    return !!member
  }
}
