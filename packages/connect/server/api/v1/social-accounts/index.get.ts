import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
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

    if (!platform) {
      const accounts = await socialMediaAccountService.getAccountsByUserId(user.id)
      log.info({ message: 'Retrieved all social media accounts', count: accounts.length })
      return accounts
    }

    log.set({ platform })

    // Get social media accounts with filters
    const accounts = await socialMediaAccountService.getAccountsForPlatform(
      platform,
      user.id
    )
    const matcher: Record<string, SchedulerPluginConstructor> = {
      facebook: FacebookPlugin,
      "linkedin-page": LinkedInPagePlugin,
      youtube: YouTubePlugin,
      google: GooglePlugin,
    }
    if (!matcher[platform] || !accounts.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid platform'
      })
    }

    const scheduler = new SchedulerPost({
      accounts: accounts
    });
    scheduler.use(matcher[platform]);

    const account = accounts.find(account => account.providerId === platform);
    if (!account) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid account'
      })
    }

    // Refresh social media tokens if necessary
    const tokenData = await getAccessTokenHelper(getHeaders(event), {
      providerId: platform,
      userId: user.id,
      accountId: account.accountId,
    }).catch(() => null)

    if (tokenData?.accessToken) {
      await socialMediaAccountService.updateAccount(account.id, {
        accessToken: tokenData.accessToken
      })
    }

    const accessToken = tokenData?.accessToken || account.accessToken;

    const pagesBaseOnTheAccount = await (scheduler as unknown as { pages: (token: string) => Promise<FacebookPage[]> }).pages(accessToken);

    entityDetailsService.createOrUpdateDetails({
      entityId: account.id,
      entityType: 'accounts_pages',
      pages: pagesBaseOnTheAccount
    })

    log.info({ message: 'Social media pages retrieved', platform, pageCount: pagesBaseOnTheAccount.length })

    return pagesBaseOnTheAccount
  } catch (error) {
    log.error({ message: 'Failed to fetch social media accounts', error })

    if (error instanceof H3Error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch social media accounts'
    })
  }
})
