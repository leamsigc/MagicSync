import { socialMediaAccountService, sanitizeSocialMediaAccount } from '#layers/BaseDB/server/services/social-media-account.service';
import { SchedulerPost, type SchedulerPluginConstructor } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { FacebookPlugin } from '#layers/BaseScheduler/server/services/plugins/facebook.plugin';
import { checkUserIsLogin, getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { H3Error, getQuery, getHeaders } from 'h3';
import { entityDetailsService } from '#layers/BaseDB/server/services/entity-details.service';
import { LinkedInPagePlugin } from '#layers/BaseScheduler/server/services/plugins/linkedin-page.plugin';
import { YouTubePlugin } from '#layers/BaseScheduler/server/services/plugins/youtube.plugin';
import { GooglePlugin } from '#layers/BaseScheduler/server/services/plugins/google.plugin';
import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';

defineRouteMeta({
  openAPI: {
    tags: ['Connection'],
    operationId: 'getSocialMediaAccounts',
    summary: 'Get Social Media Accounts',
    description: 'Get social media connections for the current user',
  },
});
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const query = getQuery(event)
    const platform = query.platformId as string;
    const businessId = query.businessId as string | undefined;

    if (!platform) {
      // If businessId provided, return business's accounts if user is member/owner
      if (businessId) {
        const { businessProfileService } = await import('#layers/BaseDB/server/services/business-profile.service')
        const businessRes = await businessProfileService.findById(businessId, user.id, event)
        if (!businessRes.success) {
          throw createError({ statusCode: 403, statusMessage: 'You do not have access to this business' })
        }
        const accounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
        log.info({ message: 'Retrieved business social media accounts', businessId, count: accounts.length })
        return accounts.map(sanitizeSocialMediaAccount)
      }
      const accounts = await socialMediaAccountService.getAccountsByUserId(user.id)
      log.info({ message: 'Retrieved all social media accounts', count: accounts.length })
      // SECURITY: strip token columns before returning accounts to the browser
      return accounts.map(sanitizeSocialMediaAccount)
    }

    log.set({ platform })

    // Get social media accounts with filters
    let accounts = await socialMediaAccountService.getAccountsForPlatform(
      platform,
      user.id
    )
    // LinkedIn personal ('linkedin') and Page ('linkedin-page') OAuth rows
    // carry the same org scopes, so an org picker works off either — fall
    // back to whichever the user connected instead of a dead-end 400.
    let effectivePlatform = platform
    if (!accounts.length && (platform === 'linkedin' || platform === 'linkedin-page')) {
      const fallback = platform === 'linkedin' ? 'linkedin-page' : 'linkedin'
      accounts = await socialMediaAccountService.getAccountsForPlatform(fallback, user.id)
      if (accounts.length) effectivePlatform = fallback
    }
    const matcher: Record<string, SchedulerPluginConstructor> = {
      facebook: FacebookPlugin,
      linkedin: LinkedInPagePlugin,
      "linkedin-page": LinkedInPagePlugin,
      youtube: YouTubePlugin,
      google: GooglePlugin,
      googlemybusiness: GooglePlugin,
    }
    if (!matcher[effectivePlatform]) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid platform'
      })
    }
    if (!accounts.length) {
      throw createError({
        statusCode: 404,
        statusMessage: `No ${platform} connection found — connect the account first`,
        message: `No ${platform} connection found — connect the account first`,
      })
    }

    const scheduler = new SchedulerPost({
      accounts: accounts
    });
    scheduler.use(matcher[effectivePlatform]);

    const account = accounts.find(account => account.providerId === effectivePlatform);
    if (!account) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid account'
      })
    }

    // Refresh social media tokens if necessary. `account` here is a Better
    // Auth row, so pass its row id (the only identifier /get-access-token
    // resolves) — never the provider account id.
    const tokenData = await getAccessTokenHelper(getHeaders(event), {
      providerId: effectivePlatform,
      userId: user.id,
      accountId: account.id,
    }).catch(() => null)

    if (tokenData?.accessToken) {
      await socialMediaAccountService.updateAccount(account.id, {
        accessToken: tokenData.accessToken
      })
    }

    const accessToken = tokenData?.accessToken || account.accessToken;

    const facebookPlugin = scheduler.getPlugin('facebook')
    if (!facebookPlugin || !(facebookPlugin instanceof FacebookPlugin)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Facebook plugin not available'
      })
    }
    const pagesBaseOnTheAccount = await facebookPlugin.pages(accessToken);

    entityDetailsService.createOrUpdateDetails({
      entityId: account.id,
      entityType: 'accounts_pages',
      pages: pagesBaseOnTheAccount
    })

    log.info({ message: 'Social media pages retrieved', platform, pageCount: pagesBaseOnTheAccount.length })

    // Tag LinkedIn orgs so the picker routes them to the Page-connect
    // handler even when listed from a personal-row token.
    if (effectivePlatform === 'linkedin' || effectivePlatform === 'linkedin-page') {
      for (const page of pagesBaseOnTheAccount) {
        (page as FacebookPage & { platformType?: string }).platformType = 'linkedin-page'
      }
    }

    return pagesBaseOnTheAccount
  } catch (error) {
    log.error({ message: 'Failed to fetch social media accounts', error })

    if (error instanceof H3Error) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    // Surface upstream OAuth/API failures instead of a generic 500: expired
    // tokens must tell the user to reconnect (LinkedIn tokens live 60 days
    // and have no refresh path here), other API errors carry the reason.
    if (/validating access token|expired|revoked|invalid.*token|unauthorized|401/i.test(message)) {
      throw createError({ statusCode: 401, statusMessage: 'Connection token expired or invalid. Please reconnect your account.' })
    }
    if (message.startsWith('LinkedIn API Error') || message.startsWith('LinkedIn API unreachable')) {
      // statusMessage must stay single-line: full upstream text goes in `message`.
      throw createError({ statusCode: 502, statusMessage: 'Upstream platform error', message })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch social media accounts'
    })
  }
})
