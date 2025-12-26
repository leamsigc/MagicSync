import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service';
import { socialMediaAccountService, type CreateSocialMediaAccountData, type SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service';
import { FacebookPlugin } from '#layers/BaseScheduler/server/services/plugins/facebook.plugin';
import { SchedulerPost, type SchedulerPluginConstructor } from '#layers/BaseScheduler/server/services/SchedulerPost.service';
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
  try {
    const user = await checkUserIsLogin(event);
    const platform = getRouterParam(event, 'platform') as SocialMediaPlatform;
    const pageId = getRouterParam(event, 'id') as string;

    if (!platform || !pageId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing platform or pageId',
      });
    }

    const body = await readBody<ConnectSocialMediaAccountBody>(event);
    const instagramId = body.instagram_business_account?.id;

    // Use the social media manager to get the page details
    const account = await socialMediaAccountService.getAccountsForPlatform(
      platform,
      user.id
    )
    const matcher: Record<string, SchedulerPluginConstructor> = {
      facebook: FacebookPlugin,
    }
    if (!matcher[platform] || !account) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid platform'
      })
    }

    const scheduler = new SchedulerPost({
      accounts: account
    });
    scheduler.use(matcher[platform]);

    const platformAccount = account.find(account => account.providerId === platform);
    if (!platformAccount) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid platform'
      })
    }

    //@ts-ignore
    const pageDetails = await scheduler.fetchPageInformation(pageId, platformAccount.accessToken, { instagramId: body.instagram_business_account?.id }) as {
      id: string;
      name: string;
      access_token: string;
      picture: string;
      username: string;
    };

    await logAuditService.logAuditEvent({
      userId: user.id,
      category: 'connection_page',
      action: `/${platform}/${pageId}`,
      targetType: 'page',
      targetId: pageId,
      ipAddress: event.node.req.socket.remoteAddress,
      userAgent: event.node.req.headers['user-agent'],
      status: 'success',
      details: JSON.stringify({ ...pageDetails, access_token: '***' }),
    })



    // handle to the social media  service to create or update
    const socialMediaAccount = socialMediaAccountService.createOrUpdateAccount({
      ...pageDetails,
      user,
      businessId: body.businessId,
      platformId: instagramId ? 'instagram' : platform,
    });



    return socialMediaAccount;

  } catch (error) {

    if (error instanceof H3Error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to connect social media account.',
    });
  }
});
