import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails';

import { eq, and, desc, inArray } from 'drizzle-orm'
import { encryptKey, decryptKey } from '#layers/BaseAuth/server/utils/AuthHelpers'
import type { SocialMediaAccount, SocialMediaAccountManager } from '#layers/BaseDB/db/socialMedia/socialMedia'
import { socialMediaAccounts, socialMediaAccountManagers } from '#layers/BaseDB/db/socialMedia/socialMedia'
import { type Account, type User, user, member, organization } from '#layers/BaseDB/db/auth/auth'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service'
import { businessProfiles, account } from '#layers/BaseDB/db/schema';
import type { SocialMediaAccountServiceType } from './interfaces';

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
  | 'wordpress'

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
}

export interface UpdateSocialMediaAccountData {
  accountName?: string
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: Date
  isActive?: boolean
  lastSyncAt?: Date
  entityDetailId?: string
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

    const accountData: SocialMediaAccount = {
      id: crypto.randomUUID(),
      userId: data.userId,
      businessId: data.businessId,
      platform: data.platform,
      accountId: data.accountId,
      accountName: data.accountName,
      accessToken: data.accessToken,
      accessTokenEncrypted: accessTokenEncrypted,
      refreshTokenEncrypted: refreshTokenEncrypted,
      tokenExpiresAt: data.tokenExpiresAt || null,
      entityDetailId: data.entityDetailId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      refreshToken: null,
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

    return account;
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
      return await baseQuery.findMany({
        where: and(...conditions),
        with: {
          entityDetail: true
        },
      })
    }

    return await baseQuery.findMany({
      with: {
        entityDetail: true
      },
    });
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

    // Encrypt tokens before storage
    const encryptedData: Record<string, unknown> = { updatedAt: new Date() }

    encryptedData.accessToken = data.accessToken
    if (data.accessToken !== undefined) {

      encryptedData.access_token_encrypted = data.accessToken
        ? await encryptKey(data.accessToken)
        : null
    }

    if (data.refreshToken !== undefined) {
      encryptedData.refreshToken = data.refreshToken
      encryptedData.refresh_token_encrypted = data.refreshToken
        ? await encryptKey(data.refreshToken)
        : null
    }

    if (data.accountName !== undefined) encryptedData.accountName = data.accountName
    if (data.tokenExpiresAt !== undefined) encryptedData.tokenExpiresAt = data.tokenExpiresAt
    if (data.isActive !== undefined) encryptedData.isActive = data.isActive
    if (data.lastSyncAt !== undefined) encryptedData.lastSyncAt = data.lastSyncAt
    if (data.entityDetailId !== undefined) encryptedData.entityDetailId = data.entityDetailId

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
   */
  async createOrUpdateAccount({ id, name, access_token, refresh_token, picture, username, user, businessId, platformId }: {
    id: string;
    name: string;
    access_token: string;
    refresh_token?: string;
    picture: string;
    username: string;
    user: User,
    businessId: string
    platformId: SocialMediaPlatform
  }) {
    const account = await this.getAccountByAccountId(id);

    // If we have a account just update the account
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


    if (account) {

      socialMediaAccount = await this.updateAccount(
        account.id,
        {
          accountName: name,
          accessToken: access_token,
          refreshToken: refresh_token,
          lastSyncAt: new Date(),
          isActive: true,
          entityDetailId: entityDetails?.id
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
        entityDetailId: entityDetails?.id
      });
    }

    return socialMediaAccount;
  }

  async createOrUpdateAccountFromAuth({ id, name, access_token, refresh_token, picture, username, platformId, user }: {
    id: string;
    name: string;
    access_token: string;
    refresh_token?: string;
    picture: string;
    username: string;
    platformId: SocialMediaPlatform;
    user: User;
  }) {
    // get business if from current user

    const businessFromUser = await this.db.query.businessProfiles.findFirst({
      where: eq(businessProfiles.userId, user.id),
    });


    return this.createOrUpdateAccount({ id, name, access_token, refresh_token, picture, username, user, businessId: businessFromUser?.id as string || '', platformId });

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
      console.error('Error deleting social media account:', error)
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
   */
  getTokenHealth(account: SocialMediaAccount): { status: 'healthy' | 'expiring_soon' | 'expired' | 'unknown'; expiresAt: Date | null; daysRemaining: number | null } {
    if (!account.tokenExpiresAt) {
      return { status: 'unknown', expiresAt: null, daysRemaining: null }
    }

    const expirationTime = typeof account.tokenExpiresAt === 'number'
      ? account.tokenExpiresAt * 1000
      : account.tokenExpiresAt.getTime()

    const expiresAt = new Date(expirationTime)
    const msRemaining = expirationTime - Date.now()
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24))

    if (msRemaining <= 0) {
      return { status: 'expired', expiresAt, daysRemaining: 0 }
    }

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
      account.accessToken ? decryptKey(account.accessToken) : null,
      account.refreshToken ? decryptKey(account.refreshToken) : null,
    ])
    return { accessToken, refreshToken }
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
