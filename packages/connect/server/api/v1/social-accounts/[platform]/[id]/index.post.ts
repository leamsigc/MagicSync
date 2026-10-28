import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service';
import { socialMediaAccountService, sanitizeSocialMediaAccount, type CreateSocialMediaAccountData, type SocialMediaPlatform } from '#layers/BaseDB/server/services/social-media-account.service';
import { FacebookPlugin } from '#layers/BaseDB/server/services/plugins/facebook.plugin';
import { LinkedInPagePlugin } from '#layers/BaseDB/server/services/plugins/linkedin-page.plugin';
import { YouTubePlugin } from '#layers/BaseDB/server/services/plugins/youtube.plugin';
import { GooglePlugin } from '#layers/BaseDB/server/services/plugins/google.plugin';
import { SchedulerPost, type SchedulerPluginConstructor } from '#layers/BaseDB/server/services/SchedulerPost.service';
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

interface PageDetails {
  id: string;
  name: string;
  access_token: string;
  picture: string;
  username: string;
}

/**
 * Page details come from the plugin matching the route platform. Only one
 * plugin is registered on the scheduler (`matcher[platform]`), so reaching for
 * any other name always misses — the old code hardcoded `'facebook'` here,
 * which is why every LinkedIn Page connect died with a 400.
 */
async function fetchPageDetails(
  scheduler: SchedulerPost,
  platform: SocialMediaPlatform,
  pageId: string,
  accessToken: string,
  instagramId?: string,
): Promise<PageDetails> {
  if (platform === 'linkedin-page') {
    const linkedInPlugin = scheduler.getPlugin('linkedin-page');
    if (!linkedInPlugin || !(linkedInPlugin instanceof LinkedInPagePlugin)) {
      throw createError({ statusCode: 400, statusMessage: 'LinkedIn Page plugin not available' });
    }
    return linkedInPlugin.fetchPageInformation(linkedInPlugin, pageId, accessToken, { page: pageId });
  }

  const facebookPlugin = scheduler.getPlugin('facebook');
  if (!facebookPlugin || !(facebookPlugin instanceof FacebookPlugin)) {
    throw createError({ statusCode: 400, statusMessage: 'Facebook plugin not available' });
  }
  return facebookPlugin.fetchPageInformation(pageId, accessToken, { instagramId });
}

/**
 * Provider fallbacks for page-level connects. A YouTube channel or a Google
 * Business location is authorized through the `google` provider, while a
 * LinkedIn Page shares the member token of the personal `linkedin` connection
 * (the org picker in index.get.ts already offers it that way). Falling back to
 * `google` for a LinkedIn page handed a Google bearer token to
 * api.linkedin.com.
 */
const PROVIDER_FALLBACKS: Partial<Record<SocialMediaPlatform, SocialMediaPlatform>> = {
  youtube: 'google',
  googlemybusiness: 'google',
  'linkedin-page': 'linkedin',
}

async function resolveProviderAccounts(platform: SocialMediaPlatform, userId: string) {
  const accounts = await socialMediaAccountService.getAccountsForPlatform(platform, userId)
  if (accounts.length > 0) return accounts
  const fallback = PROVIDER_FALLBACKS[platform]
  if (!fallback) return accounts
  return await socialMediaAccountService.getAccountsForPlatform(fallback, userId)
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
    const account = await resolveProviderAccounts(platform, user.id)
    if (account.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid platform'
      })
    }
    const matcher: Record<string, SchedulerPluginConstructor> = {
      facebook: FacebookPlugin,
      'linkedin-page': LinkedInPagePlugin,
      youtube: YouTubePlugin,
      googlemybusiness: GooglePlugin,
    }
    if (!matcher[platform]) {
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

    // platformAccount is a Better Auth row: resolve tokens by its row id
    // (the only identifier /get-access-token accepts).
    const tokenData = await getAccessTokenHelper(event as any, {
      providerId: platform,
      userId: user.id,
      accountId: platformAccount.id,
    }).catch(() => null)

    // NOTE: deliberately do NOT persist `tokenData.accessToken` here. It is a
    // Better Auth USER token; this route's social_media_accounts rows hold PAGE
    // tokens (createOrUpdateAccount below stores the one from
    // fetchPageInformation). Writing the user token onto page rows is what Meta
    // answers with "(#190) …Page Access Token" / "User Access Token Is Not
    // Supported". The user token is used only to mint the page token.
    let accessToken = tokenData?.accessToken || platformAccount.accessToken;

    // Facebook: exchange the fresh short-lived user token for a 60-day one
    // BEFORE fetching page info, so the stored page token doesn't expire.
    // A page token inherits its remaining lifetime from the user token used
    // to fetch it — skipping this is why page tokens kept dying in hours.
    if (platform === 'facebook' && tokenData?.accessToken) {
      try {
        const fbPlugin = scheduler.getPlugin('facebook')
        if (fbPlugin instanceof FacebookPlugin) {
          const exchanged = await fbPlugin.exchangeLongLivedUserToken(tokenData.accessToken)
          accessToken = exchanged.userToken
        }
      } catch (error) {
        // Non-fatal: fall back to the short-lived token; background refresh
        // and health warnings take over from here.
        log.error({ message: 'Facebook long-lived token exchange failed at connect', error: String(error) })
      }
    }

    const pageDetails = await fetchPageDetails(scheduler, platform, pageId, accessToken, body.instagram_business_account?.id);

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
    }, { log })

    log.info({ message: 'Social media page connected', platform, pageId, pageName: pageDetails.name })

    // handle to the social media  service to create or update
    const socialMediaAccount = await socialMediaAccountService.createOrUpdateAccount({
      ...pageDetails,
      user,
      businessId: body.businessId,
      platformId: instagramId ? 'instagram' : platform,
    });



    // Never return the encrypted token columns to the browser.
    return sanitizeSocialMediaAccount(socialMediaAccount);

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
