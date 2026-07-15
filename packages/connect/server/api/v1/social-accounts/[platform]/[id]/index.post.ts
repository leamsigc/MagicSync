import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service';
import { socialMediaAccountService, type CreateSocialMediaAccountData, type SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service';
import { FacebookPlugin } from '#layers/BaseScheduler/server/services/plugins/facebook.plugin';
import { LinkedInPagePlugin } from '#layers/BaseScheduler/server/services/plugins/linkedin-page.plugin';
import { YouTubePlugin } from '#layers/BaseScheduler/server/services/plugins/youtube.plugin';
import { SchedulerPost, type SchedulerPluginConstructor } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
import { checkUserIsLogin, getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { H3Error, readBody } from 'h3';

interface ConnectSocialMediaAccountBody {
  id: string;
  name: string;
  instagram_business_account?: {
    id: string
  };
  platformId: SocialMediaPlatform;
  businessId: string;
}


export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event);
    log.set({ userId: user.id })

    const platform = getRouterParam(event, 'platform') as SocialMediaPlatform;
    const pageId = getRouterParam(event, 'id') as string;

    if (!platform || !pageId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing platform or pageId',
      });
    }

    log.set({ platform, pageId })

    const body = await readBody<ConnectSocialMediaAccountBody>(event);
    const instagramId = body.instagram_business_account?.id;

    log.set({ businessId: body.businessId })

    // Use the social media manager to get the page details
    let account = await socialMediaAccountService.getAccountsForPlatform(
      platform,
      user.id
    )
    // For youtube, also check google provider (native OAuth) if no direct youtube account
    if (!account || account.length === 0) {
      const googleAccounts = await socialMediaAccountService.getAccountsForPlatform('google', user.id);
      if (googleAccounts?.length) {
        account = googleAccounts;
      }
    }
    const matcher: Record<string, SchedulerPluginConstructor> = {
      facebook: FacebookPlugin,
      'linkedin-page': LinkedInPagePlugin,
      youtube: YouTubePlugin,
    }
    if (!matcher[platform] || !account || account.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid platform'
      })
    }

    const scheduler = new SchedulerPost({
      accounts: account
    });
    scheduler.use(matcher[platform]);

    const platformAccount = account[0];
    if (!platformAccount) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid platform'
      })
    }

    const tokenData = await getAccessTokenHelper(event as any, {
      providerId: platform,
      userId: user.id,
      accountId: platformAccount.accountId,
    }).catch(() => null)

    if (tokenData?.accessToken) {
      await socialMediaAccountService.updateAccount(platformAccount.id, {
        accessToken: tokenData.accessToken
      })
    }

    const accessToken = tokenData?.accessToken || platformAccount.accessToken;

    const pageDetails = await (scheduler as unknown as { fetchPageInformation: (pageId: string, token: string, options?: { instagramId?: string }) => Promise<{ id: string; name: string; access_token: string; picture: string; username: string }> }).fetchPageInformation(pageId, accessToken, { instagramId: body.instagram_business_account?.id });

    await logAuditService.logAuditEvent({
      userId: user.id,
      category: 'connection_page',
      action: `/${platform}/${pageId}`,
      targetType: 'page',
      targetId: pageId,
      ipAddress: event.node.req.socket.remoteAddress,
      userAgent: event.node.req.headers['user-agent'],
      status: 'success',
      details: JSON.stringify({ id: pageDetails.id, name: pageDetails.name, picture: pageDetails.picture, username: pageDetails.username }),
    })

    log.info({ message: 'Social media page connected', platform, pageId, pageName: pageDetails.name })

    // handle to the social media  service to create or update
    const socialMediaAccount = await socialMediaAccountService.createOrUpdateAccount({
      ...pageDetails,
      user,
      businessId: body.businessId,
      platformId: instagramId ? 'instagram' : platform,
    });



    return socialMediaAccount;

  } catch (error) {
    log.error({ message: 'Failed to connect social media account', error })

    if (error instanceof H3Error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to connect social media account.',
    });
  }
});
