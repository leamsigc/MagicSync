import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails';

import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import { encryptKey, decryptKey } from '#layers/BaseAuth/server/utils/AuthHelpers'
import type { SocialMediaAccount, SocialMediaAccountManager } from '#layers/BaseDB/db/socialMedia/socialMedia'
import { socialMediaAccounts, socialMediaAccountManagers } from '#layers/BaseDB/db/socialMedia/socialMedia'
import { type Account, type User, user, member, organization } from '#layers/BaseDB/db/auth/auth'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service'
import { businessProfiles, account } from '#layers/BaseDB/db/schema';
import type { SocialMediaAccountServiceType } from './interfaces';
import type { ServiceResponse } from './types'

export type SocialMediaPlatform =
  | 'facebook'
  | 'instagram'
  | 'instagram-standalone'
  | 'twitter'
  | 'tiktok'
  | 'google'
  | 'googlemybusiness'
  | 'discord'
  | 'linkedin'
  | 'linkedin-page'
  | 'threads'
  | 'youtube'
  | 'bluesky'
  | 'devto'
  | 'dribbble'
  | 'reddit'
  | 'snapchat'
  | 'wordpress'
  | 'devnull'

export interface CreateSocialMediaAccountData {
  userId: string
  businessId: string
  platform: SocialMediaPlatform
  accountId: string
  accountName: string
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
  entityDetailId?: string
  baseUrl?: string | null
}

export interface UpdateSocialMediaAccountData {
  accountName?: string
  accessToken?: string
  refreshToken?: string
  // null clears the expiry (e.g. non-expiring Facebook page tokens)
  tokenExpiresAt?: Date | null
  isActive?: boolean
  lastSyncAt?: Date
  entityDetailId?: string
  baseUrl?: string | null
}

export interface TokenRefreshData {
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
}

export interface SocialMediaAccountFilters {
  userId?: string
  businessId?: string
  platform?: SocialMediaPlatform
  isActive?: boolean
}

export interface UpdateConnectionSettingsData {
  businessId?: string
  managerIds?: string[]
}

export interface ConnectionWithManagers {
  account: SocialMediaAccount
  currentManagers: SocialMediaAccountManager[]
  availableUsers: Array<{ id: string; name: string; email: string; image: string | null }>
  availableBusinesses: Array<{ id: string; name: string }>
}

/**
 * SECURITY: Strip sensitive token columns before returning accounts to the client.
 * Never expose accessToken / refreshToken (plaintext or encrypted) via API responses.
 */
export function sanitizeSocialMediaAccount<T extends SocialMediaAccount>(
  account: T
): Omit<T, 'accessToken' | 'refreshToken' | 'accessTokenEncrypted' | 'refreshTokenEncrypted'> {
  const { accessToken: _at, refreshToken: _rt, accessTokenEncrypted: _ate, refreshTokenEncrypted: _rte, ...safeAccount } = account
  void _at
  void _rt
  void _ate
  void _rte
  return safeAccount
}

export class SocialMediaAccountService implements SocialMediaAccountServiceType {
  private db = useDrizzle()


  async getUserByAccountId(id: string) {
    const userDetails = await this.db.query.user.findFirst({
      where: eq(user.id, id),
    });

    return userDetails
  }
  async getActualAccountByAccountId(id: string) {
    const details = await this.db.query.socialMediaAccounts.findFirst({
      where: eq(socialMediaAccounts.id, id),
    });

    return details

  }
  async getBetterAuthAccountId(providerId: string, userId: string, smAccountId: string): Promise<Account | null> {
    return await this.db.query.account.findFirst({
      where: and(
        eq(account.providerId, providerId),
        eq(account.userId, userId),
        eq(account.accountId, smAccountId)
      )
    }) || null;
  }

  /**
   * Get a Better Auth OAuth row by its own id, scoped to the user.
   * Needed because provider-level UI cards carry this id, while page-level
   * cards carry the social_media_accounts id.
   */
  async getBetterAuthAccountById(id: string, userId: string): Promise<ServiceResponse<Account | null>> {
    try {
      const row = await this.db.query.account.findFirst({
        where: and(
          eq(account.id, id),
          eq(account.userId, userId)
        ),
      })
      return { success: true, data: row ?? null }
    }
    catch (error) {
      return { success: false, error: 'Failed to find provider account' }
    }
  }

  /**
   * Find the Better Auth OAuth row to refresh through.
   *
   * Better Auth resolves `/get-access-token` strictly by its own row id
   * (`account.id`), NOT by the provider's account id and NOT by our
   * social_media_accounts id (for YouTube those are channel id / Google sub —
   * three different identifiers). Callers must pass the returned row's id.
   * Prefers the most recently updated row that still holds a refresh token.
   */
  async findBetterAuthAccountForRefresh(
    userId: string,
    providerId: string
  ): Promise<ServiceResponse<Account | null>> {
    try {
      const rows = await this.db.query.account.findMany({
        where: and(
          eq(account.userId, userId),
          eq(account.providerId, providerId)
        ),
        orderBy: [desc(account.updatedAt)],
      })
      if (rows.length === 0) return { success: true, data: null }
      const withRefresh = rows.find((row) => !!row.refreshToken)
      return { success: true, data: withRefresh ?? rows[0] ?? null }
    }
    catch (error) {
      return { success: false, error: 'Failed to find provider account' }
    }
  }
  async getUserAccountsCompleteDetails(id: string) {
    const userAccounts = await this.db.query.account.findMany({
      where: eq(account.userId, id),
    });

    if (userAccounts.length === 0) {
      return []
    }

    // FIX: batch-fetch all entity details in a single query instead of N individual calls
    const accountIds = userAccounts.map((a: typeof userAccounts[number]) => a.id)
    const allEntityDetails = await this.db.query.entityDetails.findMany({
      where: and(
        inArray(entityDetails.entityId, accountIds),
        eq(entityDetails.entityType, 'accounts_pages')
      )
    })
    const detailsMap = new Map(allEntityDetails.map((d: typeof allEntityDetails[number]) => [d.entityId, d]))

    return userAccounts.map((account: typeof userAccounts[number]) => ({
      ...account,
      ...(detailsMap.get(account.id) ?? null)
    }))
  }

  /**
   * Create a new social media account
   */
  async createAccount(data: CreateSocialMediaAccountData): Promise<SocialMediaAccount> {
    // Encrypt tokens before storage
    const accessTokenEncrypted = data.accessToken
      ? await encryptKey(data.accessToken)
      : null
    const refreshTokenEncrypted = data.refreshToken
      ? await encryptKey(data.refreshToken)
      : null

    // Platform-specific expiry: Facebook page tokens are long-lived (~60d), Google short-lived (~1h) but refreshable
    const platformExpiryDays: Record<string, number> = {
      facebook: 60,
      instagram: 60,
      youtube: 1 / 24, // 1 hour
      google: 1 / 24,
      googlemybusiness: 1 / 24,
    }
    const defaultExpiry = data.tokenExpiresAt || (platformExpiryDays[data.platform]
      ? new Date(Date.now() + platformExpiryDays[data.platform] * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000))

    const accountData: SocialMediaAccount = {
      id: crypto.randomUUID(),
      userId: data.userId,
      businessId: data.businessId,
      platform: data.platform,
      accountId: data.accountId,
      accountName: data.accountName,
      baseUrl: data.baseUrl ?? null,
      // Only the ciphertext is persisted. `accessToken` stays non-null (schema)
      // but never holds the plaintext credential; readers hydrate through
      // `withPlaintextTokens()` / `getDecryptedTokens()`.
      accessToken: accessTokenEncrypted ?? '',
      accessTokenEncrypted: accessTokenEncrypted,
      refreshTokenEncrypted: refreshTokenEncrypted,
      tokenExpiresAt: defaultExpiry,
      entityDetailId: data.entityDetailId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      refreshToken: refreshTokenEncrypted,
      lastSyncAt: null
    }

    const result = await this.db
      .insert(socialMediaAccounts)
      .values(accountData)
      .returning()

    const [account] = result

    if (!account) {
      throw new Error('Failed to create social media account')
    }

    return account
  }

  /**
   * Get social media account by ID
   * SECURITY: Requires userId ownership check
   */
  async getAccountById(id: string, userId?: string) {
    const account = await this.db.query.socialMediaAccounts.findFirst({
      where: eq(socialMediaAccounts.id, id),
      with: {
        entityDetail: true,
        user: true
      },
    });

    // Ownership verification: if userId is provided, verify the account belongs to that user
    if (userId && (!account || account.userId !== userId)) {
      return null;
    }

    return account ? this.withPlaintextTokens(account) : null;
  }

  async getAccountsByIds(ids: string[], userId?: string): Promise<SocialMediaAccount[]> {
    if (ids.length === 0) return []
    const conditions = [inArray(socialMediaAccounts.id, ids)]
    if (userId) conditions.push(eq(socialMediaAccounts.userId, userId))
    const accounts = await this.db.query.socialMediaAccounts.findMany({
      where: and(...conditions),
    })
    return this.withPlaintextTokensAll(accounts)
  }

  /**
   * Get social media accounts with filters
   */
  async getAccounts(filters: SocialMediaAccountFilters = {}): Promise<SocialMediaAccount[]> {
    const conditions = []

    if (filters.userId) {
      conditions.push(eq(socialMediaAccounts.userId, filters.userId))
    }

    if (filters.businessId) {
      conditions.push(eq(socialMediaAccounts.businessId, filters.businessId))
    }

    if (filters.platform) {
      conditions.push(eq(socialMediaAccounts.platform, filters.platform))
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(socialMediaAccounts.isActive, filters.isActive))
    }

    const baseQuery = this.db.query.socialMediaAccounts

    if (conditions.length > 0) {
      const accounts = await baseQuery.findMany({
        where: and(...conditions),
        with: {
          entityDetail: true
        },
      })
      return this.withPlaintextTokensAll(accounts)
    }

    const all = await baseQuery.findMany({
      with: {
        entityDetail: true
      },
    });
    return this.withPlaintextTokensAll(all)
  }

  /**
   * Get accounts by user ID
   */
  async getAccountsByUserId(userId: string): Promise<SocialMediaAccount[]> {
    return this.getAccounts({ userId, isActive: true })
  }

  /**
   * Get accounts by business ID
   */
  async getAccountsByBusinessId(businessId: string): Promise<SocialMediaAccount[]> {
    return this.getAccounts({ businessId, isActive: true })
  }
  async getAccountsByBusinessIdWithOutActiveCheck(businessId: string): Promise<SocialMediaAccount[]> {
    return this.getAccounts({ businessId })
  }

  /**
   * Get accounts by platform
   */
  async getAccountsForPlatform(platform: string, userId: string): Promise<Account[]> {

    const userAccount = await this.db.select()
      .from(account)
      .where(eq(account.userId, userId))
      .all();


    const accounts = userAccount.filter(account => account.providerId === platform);

    return accounts;
  }

  /**
   * Get account by platform and account ID (for uniqueness check)
   */
  async getAccountByPlatformAndAccountId(
    userId: string,
    platform: SocialMediaPlatform,
    accountId: string
  ): Promise<SocialMediaAccount | null> {

    const account = await this.db.query.socialMediaAccounts.findFirst({
      where: and(
        eq(socialMediaAccounts.userId, userId),
        eq(socialMediaAccounts.platform, platform),
        eq(socialMediaAccounts.accountId, accountId)
      ),
    })

    return account || null
  }

  /**
   * Get account by provider-side account ID, scoped to the user.
   * Fallback for callers holding a channel/page/DID id instead of the row PK.
   */
  async getAccountByProviderAccountId(
    userId: string,
    providerAccountId: string
  ): Promise<SocialMediaAccount | null> {

    const account = await this.db.query.socialMediaAccounts.findFirst({
      where: and(
        eq(socialMediaAccounts.userId, userId),
        eq(socialMediaAccounts.accountId, providerAccountId)
      ),
    })

    return account || null
  }

  /**
   * Update social media account
   * SECURITY: Requires userId ownership check
   */
  async updateAccount(id: string, data: UpdateSocialMediaAccountData, userId?: string): Promise<SocialMediaAccount | null> {
    // Ownership verification: if userId is provided, verify the account belongs to that user
    if (userId) {
      const existing = await this.db.query.socialMediaAccounts.findFirst({
        where: eq(socialMediaAccounts.id, id),
      })
      if (!existing || existing.userId !== userId) {
        return null
      }
    }

    // Encrypt tokens before storage — the plaintext never touches a column.
    const encryptedData: Record<string, unknown> = { updatedAt: new Date() }

    if (data.accessToken !== undefined) {
      const encryptedAccessToken = data.accessToken ? await encryptKey(data.accessToken) : ''
      encryptedData.accessToken = encryptedAccessToken
      encryptedData.accessTokenEncrypted = encryptedAccessToken || null
    }

    // Never wipe a stored refresh token with null/undefined. Providers omit
    // refresh_token on re-grants (Google only sends it with a consent grant),
    // and Better Auth preserves the previous one — the mirror must do the same.
    if (data.refreshToken) {
      const encryptedRefreshToken = await encryptKey(data.refreshToken)
      encryptedData.refreshToken = encryptedRefreshToken
      encryptedData.refreshTokenEncrypted = encryptedRefreshToken
    }

    if (data.accountName !== undefined) encryptedData.accountName = data.accountName
    if (data.tokenExpiresAt !== undefined) encryptedData.tokenExpiresAt = data.tokenExpiresAt
    if (data.isActive !== undefined) encryptedData.isActive = data.isActive
    if (data.lastSyncAt !== undefined) encryptedData.lastSyncAt = data.lastSyncAt
    if (data.entityDetailId !== undefined) encryptedData.entityDetailId = data.entityDetailId
    if (data.baseUrl !== undefined) encryptedData.baseUrl = data.baseUrl

    const [account] = await this.db
      .update(socialMediaAccounts)
      .set(encryptedData)
      .where(eq(socialMediaAccounts.id, id))
      .returning()

    if (!account) {
      return null
    }

    return account || null
  }

  /**
   * Create or update social media account
   * Handles platform-specific token expiry (Facebook 60d vs Google 1h)
   */
  async createOrUpdateAccount({ id, name, access_token, refresh_token, picture, username, user, businessId, platformId, tokenExpiresAt, baseUrl }: {
    id: string;
    name: string;
    access_token: string;
    refresh_token?: string;
    picture: string;
    username: string;
    user: User,
    businessId: string
    platformId: SocialMediaPlatform
    tokenExpiresAt?: Date
    baseUrl?: string | null
  }) {
    const account = await this.db.query.socialMediaAccounts.findFirst({
      where: and(
        eq(socialMediaAccounts.userId, user.id),
        eq(socialMediaAccounts.platform, platformId),
        eq(socialMediaAccounts.accountId, id),
      ),
      with: { entityDetail: true },
    })

    let socialMediaAccount;
    let entityDetails;

    if (account && account.entityDetail?.id) {
      entityDetails = await entityDetailsService.updateDetails(account.entityDetail.id, { details: { username, picture } });
    } else {
      entityDetails = await entityDetailsService.createDetails({
        entityId: id,
        entityType: 'social_media_account',
        details: { username, picture, pages: [] },
      });
    }


    // Compute platform-aware expiry if not explicitly provided
    const platformExpiryDays: Record<string, number> = {
      facebook: 60,
      instagram: 60,
      youtube: 1 / 24,
      google: 1 / 24,
      googlemybusiness: 1 / 24,
    }
    const computedExpiry = tokenExpiresAt || (platformExpiryDays[platformId]
      ? new Date(Date.now() + platformExpiryDays[platformId] * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000))

    if (account) {

      socialMediaAccount = await this.updateAccount(
        account.id,
        {
          accountName: name,
          accessToken: access_token,
          // Pass through only when truthy: updateAccount skips undefined, so a
          // missing refresh_token can never wipe the stored one.
          refreshToken: refresh_token || undefined,
          tokenExpiresAt: computedExpiry,
          lastSyncAt: new Date(),
          isActive: true,
          entityDetailId: entityDetails?.id,
          // undefined preserves any stored value (non-Bluesky platforms).
          baseUrl: baseUrl ?? undefined
        }
      );
    } else {
      // create account
      socialMediaAccount = await this.createAccount({
        userId: user.id,
        businessId: businessId,
        platform: platformId,
        accountId: id,
        accountName: name,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt: computedExpiry,
        entityDetailId: entityDetails?.id,
        baseUrl: baseUrl ?? null
      });
    }

    return socialMediaAccount;
  }

  async createOrUpdateAccountFromAuth({ id, name, access_token, refresh_token, picture, username, platformId, user, tokenExpiresAt }: {
    id: string;
    name: string;
    access_token: string;
    refresh_token?: string;
    picture: string;
    username: string;
    platformId: SocialMediaPlatform;
    user: User;
    tokenExpiresAt?: Date;
  }) {
    const businessId = await this.resolveBusinessForUser(user.id);

    return this.createOrUpdateAccount({ id, name, access_token, refresh_token, picture, username, user, businessId, platformId, tokenExpiresAt });

  }

  private async resolveBusinessForUser(userId: string): Promise<string> {
    const active = await this.db.query.businessProfiles.findFirst({
      where: and(eq(businessProfiles.userId, userId), eq(businessProfiles.isActive, true)),
      orderBy: [desc(businessProfiles.updatedAt)],
    })
    if (active) return active.id

    const first = await this.db.query.businessProfiles.findFirst({
      where: eq(businessProfiles.userId, userId),
      orderBy: [asc(businessProfiles.createdAt)],
    })
    return first?.id ?? ''
  }
  async getAccountByAccountId(id: string, userId?: string) {
    const account = await this.db.query.socialMediaAccounts.findFirst({
      where: eq(socialMediaAccounts.accountId, id),
      with: {
        entityDetail: true
      },
    });

    // Ownership verification: if userId is provided, verify the account belongs to that user
    if (userId && (!account || account.userId !== userId)) {
      return null;
    }

    return account;
  }

  /**
   * Refresh OAuth tokens for an account
   * SECURITY: Requires userId ownership check
   */
  async refreshTokens(id: string, tokenData: TokenRefreshData, userId?: string): Promise<SocialMediaAccount | null> {
    return this.updateAccount(id, {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.tokenExpiresAt,
      lastSyncAt: new Date(),
    }, userId)
  }

  /**
   * Deactivate social media account (soft delete)
   * SECURITY: Requires userId ownership check
   */
  async deactivateAccount(id: string, userId?: string): Promise<SocialMediaAccount | null> {
    return this.updateAccount(id, { isActive: false }, userId)
  }

  /**
   * Delete social media account (hard delete)
   */
  async deleteAccount(id: string, userId?: string): Promise<boolean> {
    try {
      // FIX: ownership check — prevent users from deleting other users' accounts
      if (userId) {
        const existing = await this.db.query.socialMediaAccounts.findFirst({
          where: eq(socialMediaAccounts.id, id),
        })
        if (!existing || existing.userId !== userId) {
          return false
        }
      }

      await this.db
        .delete(socialMediaAccounts)
        .where(eq(socialMediaAccounts.id, id))

      return true
    } catch (error) {
      log.error({ message: 'Error deleting social media account', error: String(error) })
      return false
    }
  }

  /**
   * Check if token is expired or about to expire (within 5 minutes)
   */
  isTokenExpired(account: Account): boolean {
    if (!account.accessTokenExpiresAt) return false

    const expirationTime = typeof account.accessTokenExpiresAt === 'number'
      ? account.accessTokenExpiresAt * 1000
      : account.accessTokenExpiresAt.getTime()

    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000)
    return expirationTime <= fiveMinutesFromNow
  }

  /**
   * Token health status for UI indicators
   * Differentiates short-lived (Google/YouTube 1h, refreshable) vs long-lived (Facebook 60d)
   */
  getTokenHealth(account: SocialMediaAccount): { status: 'healthy' | 'expiring_soon' | 'expired' | 'unknown'; expiresAt: Date | null; daysRemaining: number | null } {
    if (!account.tokenExpiresAt) {
      // No expiry stored: treat as healthy if we have a token, unknown otherwise
      // For Google with refresh_token, token is always refreshable so don't warn
      if (account.accessToken) return { status: 'healthy', expiresAt: null, daysRemaining: null }
      return { status: 'unknown', expiresAt: null, daysRemaining: null }
    }

    const expirationTime = typeof account.tokenExpiresAt === 'number'
      ? account.tokenExpiresAt * 1000
      : account.tokenExpiresAt.getTime()

    const expiresAt = new Date(expirationTime)
    const msRemaining = expirationTime - Date.now()
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24))
    const hoursRemaining = msRemaining / (1000 * 60 * 60)

    if (msRemaining <= 0) {
      return { status: 'expired', expiresAt, daysRemaining: 0 }
    }

    // Short-lived OAuth (Google/YouTube/GMB) - refresh token handles renewal, only warn within 1h
    const shortLivedPlatforms = ['google', 'googlemybusiness', 'youtube']
    if (shortLivedPlatforms.includes(account.platform)) {
      // If we have a refresh token, Better Auth renews on demand — a 1h Google
      // token would otherwise report expiring_soon from the moment of connect
      // (60min remaining <= 60min threshold). Warn only in the final minutes.
      if (account.refreshToken || account.refreshTokenEncrypted) {
        if (msRemaining <= 10 * 60 * 1000) return { status: 'expiring_soon', expiresAt, daysRemaining }
        return { status: 'healthy', expiresAt, daysRemaining }
      }
      if (hoursRemaining <= 24) return { status: 'expiring_soon', expiresAt, daysRemaining }
      return { status: 'healthy', expiresAt, daysRemaining }
    }

    // Long-lived (Facebook/Instagram 60d): warn 7 days before expiry like before
    if (daysRemaining <= 7) {
      return { status: 'expiring_soon', expiresAt, daysRemaining }
    }

    return { status: 'healthy', expiresAt, daysRemaining }
  }

  /**
   * Get detailed token health for all accounts of a business
   */
  async getBusinessTokenHealth(businessId: string): Promise<Array<SocialMediaAccount & { health: { status: string; expiresAt: Date | null; daysRemaining: number | null } }>> {
    const accounts = await this.getAccounts({ businessId, isActive: true })
    return accounts.map(account => ({
      ...account,
      health: this.getTokenHealth(account)
    }))
  }

  /**
   * Decrypt OAuth tokens from stored encrypted values.
   * Returns plain-text tokens for API usage.
   */
  async getDecryptedTokens(account: SocialMediaAccount): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.revealToken(account.accessToken),
      this.revealToken(account.refreshToken),
    ])
    return { accessToken, refreshToken }
  }

  /**
   * Decrypt one stored token. Legacy rows written before the encryption
   * migration held plaintext; those are returned as-is until the backfill task
   * re-encrypts them, so publishing never breaks mid-rollout.
   */
  private async revealToken(stored: string | null | undefined): Promise<string | null> {
    if (!stored) return null
    // Peel up to two layers: rows written while the connect route also
    // encrypted ended up as enc(enc(secret)). The tokens:encrypt task
    // normalises them, but reads must not depend on the task having run.
    let value = stored
    for (let layer = 0; layer < 2; layer += 1) {
      const decrypted = await decryptKey(value)
      if (!decrypted) break
      value = decrypted
    }
    return value
  }

  /**
   * Hydrate plaintext tokens into an account object at the read boundary.
   * The database only ever holds ciphertext; every caller (plugins, schedulers,
   * stats collectors) expects a usable bearer token in memory.
   */
  private async withPlaintextTokens<T extends SocialMediaAccount>(account: T): Promise<T> {
    const [accessToken, refreshToken] = await Promise.all([
      this.revealToken(account.accessToken),
      this.revealToken(account.refreshToken),
    ])
    return { ...account, accessToken: accessToken ?? '', refreshToken: refreshToken ?? null }
  }

  private withPlaintextTokensAll<T extends SocialMediaAccount>(accounts: T[]): Promise<T[]> {
    return Promise.all(accounts.map(account => this.withPlaintextTokens(account)))
  }

  /**
   * Get accounts that need token refresh
   */
  async getAccountsNeedingRefresh(): Promise<SocialMediaAccount[]> {
    const accounts = await this.getAccounts({ isActive: true })
    return accounts.filter(account => this.isTokenExpired(account))
  }

  /**
   * Validate account connection by checking token validity
   * SECURITY: Requires userId ownership check
   */
  async validateAccountConnection(id: string, userId?: string): Promise<{ isValid: boolean; needsRefresh: boolean }> {
    const account = await this.getAccountById(id, userId)

    if (!account || !account.isActive) {
      return { isValid: false, needsRefresh: false }
    }

    const needsRefresh = this.isTokenExpired(account)

    // For now, we'll assume the account is valid if it exists and is active
    // In a real implementation, you'd make an API call to verify the token
    return { isValid: true, needsRefresh }
  }

  /**
   * Get account with its current managers
   * SECURITY: Requires userId ownership check
   */
  async getAccountWithManagers(id: string, userId?: string) {
    const account = await this.getAccountById(id, userId)
    if (!account) return null

    const managers = await this.db
      .select({
        socialMediaAccountId: socialMediaAccountManagers.socialMediaAccountId,
        userId: socialMediaAccountManagers.userId,
        createdAt: socialMediaAccountManagers.createdAt,
        updatedAt: socialMediaAccountManagers.updatedAt,
        managerUserId: user.id,
        managerUserName: user.name,
        managerUserEmail: user.email,
        managerUserImage: user.image,
      })
      .from(socialMediaAccountManagers)
      .leftJoin(user, eq(socialMediaAccountManagers.userId, user.id))
      .where(eq(socialMediaAccountManagers.socialMediaAccountId, id))

    return {
      ...account,
      managers: managers.map(m => ({
        socialMediaAccountId: m.socialMediaAccountId,
        userId: m.userId,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        user: m.managerUserId ? {
          id: m.managerUserId,
          name: m.managerUserName,
          email: m.managerUserEmail,
          image: m.managerUserImage,
        } : null,
      })),
    }
  }

  /**
   * Get organization members for a user (users that can be assigned as managers)
   * Returns users who are members of any organization that the given user belongs to
   */
  async getOrganizationMembers(userId: string) {
    const memberIds = await this.db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))

    if (memberIds.length === 0) {
      return []
    }

    const orgIds = memberIds.map(m => m.organizationId)
    const members = await this.db
      .select({
        userId: member.userId,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(inArray(member.organizationId, orgIds))

    return members.map(m => ({
      id: m.userId,
      name: m.userName || 'Unknown',
      email: m.userEmail || '',
      image: m.userImage,
    }))
  }

  /**
   * Get all businesses owned by a user
   */
  async getUserBusinesses(userId: string) {
    const businesses = await this.db
      .select({ id: businessProfiles.id, name: businessProfiles.name })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))

    return businesses
  }

  /**
   * Get connection settings for editing (account, managers, available users, available businesses)
   * SECURITY: Only the account owner can access this
   */
  async getConnectionSettings(id: string, requestingUserId: string): Promise<ConnectionWithManagers | null> {
    const accountWithManagers = await this.getAccountWithManagers(id, requestingUserId)
    if (!accountWithManagers) return null

    const [account] = await this.db
      .select()
      .from(socialMediaAccounts)
      .where(eq(socialMediaAccounts.id, id))

    if (!account) return null

    if (account.userId !== requestingUserId) {
      return null
    }

    const [availableUsers, availableBusinesses] = await Promise.all([
      this.getOrganizationMembers(requestingUserId),
      this.getUserBusinesses(requestingUserId),
    ])

    return {
      account: accountWithManagers,
      currentManagers: accountWithManagers.managers as SocialMediaAccountManager[],
      availableUsers,
      availableBusinesses,
    }
  }

  /**
   * Update connection settings (business and/or managers)
   * SECURITY: Only the account owner can update this
   */
  async updateConnectionSettings(
    id: string,
    requestingUserId: string,
    data: UpdateConnectionSettingsData
  ): Promise<{ success: boolean; error?: string }> {
    const account = await this.db.query.socialMediaAccounts.findFirst({
      where: eq(socialMediaAccounts.id, id),
    })

    if (!account) {
      return { success: false, error: 'Account not found' }
    }

    if (account.userId !== requestingUserId) {
      return { success: false, error: 'Only the account owner can update settings' }
    }

    if (data.businessId !== undefined) {
      await this.db
        .update(socialMediaAccounts)
        .set({ businessId: data.businessId, updatedAt: new Date() })
        .where(eq(socialMediaAccounts.id, id))
    }

    if (data.managerIds !== undefined) {
      await this.db
        .delete(socialMediaAccountManagers)
        .where(eq(socialMediaAccountManagers.socialMediaAccountId, id))

      if (data.managerIds.length > 0) {
        const managerValues = data.managerIds.map(managerId => ({
          socialMediaAccountId: id,
          userId: managerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))

        await this.db
          .insert(socialMediaAccountManagers)
          .values(managerValues)
      }
    }

    return { success: true }
  }
}

// Export singleton instance
export const socialMediaAccountService = new SocialMediaAccountService()
