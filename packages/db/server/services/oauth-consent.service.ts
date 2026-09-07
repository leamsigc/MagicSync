import { and, desc, eq } from 'drizzle-orm'
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { PaginatedResponse, QueryOptions, ServiceResponse } from './types'

export interface OAuthGrant {
  id: string
  clientId: string
  clientName: string | null
  scopes: string[]
  businessId: string | null
  createdAt: Date | null
  updatedAt: Date | null
}

/**
 * OAuth consent grants (MCP connectors authorized via the @better-auth/mcp
 * authorization server). Business binding lives on the consent row
 * (oauthConsent.businessId, picked on the consent screen) — every token minted
 * from the grant inherits exactly that business.
 */
class OAuthConsentService {
  private db = useDrizzle()

  /**
   * Attach the picked business to the newest consent for (clientId, userId).
   * Called server-side immediately after the plugin consent endpoint succeeds,
   * before returning redirect_uri — order is controlled by our consent route.
   */
  async attachBusiness(clientId: string, userId: string, businessId: string): Promise<ServiceResponse<OAuthGrant>> {
    try {
      const [latest] = await this.db
        .select()
        .from(oauthConsent)
        .where(and(eq(oauthConsent.clientId, clientId), eq(oauthConsent.userId, userId)))
        .orderBy(desc(oauthConsent.updatedAt))
        .limit(1)

      if (!latest) {
        return { success: false, error: 'No consent found for this client — accept consent first' }
      }

      const [updated] = await this.db
        .update(oauthConsent)
        .set({ businessId, updatedAt: dayjs.utc().toDate() })
        .where(eq(oauthConsent.id, latest.id))
        .returning()

      return { success: true, data: await this.toGrant(updated) }
    }
    catch {
      return { success: false, error: 'Failed to attach business to consent' }
    }
  }

  /**
   * Resolve the business bound to a (clientId, userId) grant. Used by the MCP
   * OAuth token path to build the key-equivalent ApiKeyContext.
   */
  async getBusinessForGrant(clientId: string, userId: string): Promise<ServiceResponse<string>> {
    try {
      const [latest] = await this.db
        .select({ businessId: oauthConsent.businessId })
        .from(oauthConsent)
        .where(and(eq(oauthConsent.clientId, clientId), eq(oauthConsent.userId, userId)))
        .orderBy(desc(oauthConsent.updatedAt))
        .limit(1)

      if (!latest?.businessId) {
        return { success: false, error: 'No business bound to this grant' }
      }
      return { success: true, data: latest.businessId }
    }
    catch {
      return { success: false, error: 'Failed to resolve grant business' }
    }
  }

  async listForUser(userId: string, options: QueryOptions = {}): Promise<PaginatedResponse<OAuthGrant>> {
    try {
      const { pagination = { page: 1, limit: 20 } } = options
      const limit = pagination.limit || 20
      const offset = ((pagination.page || 1) - 1) * limit

      const rows = await this.db
        .select({
          consent: oauthConsent,
          clientName: oauthClient.name,
        })
        .from(oauthConsent)
        .leftJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
        .where(eq(oauthConsent.userId, userId))
        .orderBy(desc(oauthConsent.updatedAt))
        .limit(limit)
        .offset(offset)

      return {
        success: true,
        data: rows.map(r => this.toGrantSync(r.consent, r.clientName)),
        pagination: {
          page: pagination.page || 1,
          limit,
          total: rows.length,
          totalPages: 1,
        },
      }
    }
    catch {
      return { success: false, error: 'Failed to list OAuth grants' }
    }
  }

  async revoke(id: string, userId: string): Promise<ServiceResponse<void>> {
    try {
      const [existing] = await this.db
        .select({ id: oauthConsent.id, clientId: oauthConsent.clientId })
        .from(oauthConsent)
        .where(and(eq(oauthConsent.id, id), eq(oauthConsent.userId, userId)))
        .limit(1)

      if (!existing) {
        return { success: false, error: 'Grant not found' }
      }

      // Consent row + every token minted from the grant. Stored refresh/access
      // rows die here; short-lived JWT access tokens additionally expire on
      // their own, and session-bound ones die with the session (per docs).
      await this.db.delete(oauthConsent).where(eq(oauthConsent.id, id))
      await this.db.delete(oauthRefreshToken).where(
        and(eq(oauthRefreshToken.clientId, existing.clientId), eq(oauthRefreshToken.userId, userId))
      )
      await this.db.delete(oauthAccessToken).where(
        and(eq(oauthAccessToken.clientId, existing.clientId), eq(oauthAccessToken.userId, userId))
      )
      return { success: true, data: undefined }
    }
    catch {
      return { success: false, error: 'Failed to revoke grant' }
    }
  }

  private parseScopes(raw: string | null): string[] {
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
    }
    catch {
      return raw.split(' ').filter(Boolean)
    }
  }

  private toGrantSync(consent: typeof oauthConsent.$inferSelect, clientName: string | null): OAuthGrant {
    return {
      id: consent.id,
      clientId: consent.clientId,
      clientName,
      scopes: this.parseScopes(consent.scopes),
      businessId: consent.businessId,
      createdAt: consent.createdAt,
      updatedAt: consent.updatedAt,
    }
  }

  private async toGrant(consent: typeof oauthConsent.$inferSelect): Promise<OAuthGrant> {
    const [client] = await this.db
      .select({ name: oauthClient.name })
      .from(oauthClient)
      .where(eq(oauthClient.clientId, consent.clientId))
      .limit(1)
    return this.toGrantSync(consent, client?.name ?? null)
  }
}

export const oauthConsentService = new OAuthConsentService()
