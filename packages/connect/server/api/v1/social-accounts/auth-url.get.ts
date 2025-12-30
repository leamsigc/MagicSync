import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers";
import { SchedulerPost } from "#layers/BaseScheduler/server/services/SchedulerPost.service";
import { getPluginForPlatform } from "#layers/BaseScheduler/server/utils/pluginLoader";

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const platform = query.platform as string;
    const businessId = query.businessId as string;

    if (!platform) {
        throw createError({
            statusCode: 400,
            statusMessage: "Platform is required",
        });
    }

    const user = await checkUserIsLogin(event);
    const pluginClass = getPluginForPlatform(platform);

    if (!pluginClass) {
        throw createError({
            statusCode: 400,
            statusMessage: `Platform ${platform} not supported by scheduler`,
        });
    }

    const scheduler = new SchedulerPost({});
    scheduler.use(pluginClass);

    const { url, state, codeVerifier } = await scheduler.getAuthUrl(platform, businessId);

    if (state) {
        setCookie(event, `${platform}_oauth_state`, state, {
            httpOnly: true,
            secure: true,
            maxAge: 600, // 10 minutes
            path: "/",
        });
    }

    if (codeVerifier) {
        setCookie(event, `${platform}_oauth_code_verifier`, codeVerifier, {
            httpOnly: true,
            secure: true,
            maxAge: 600, // 10 minutes
            path: "/",
        });
    }

    return { url };
});
