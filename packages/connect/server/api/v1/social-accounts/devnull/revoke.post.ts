import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin, getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
import { account } from '#layers/BaseDB/db/auth/auth';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const log = useLogger(event);
  try {
    const user = await checkUserIsLogin(event);
    log.set({ userId: user.id });

    const body = await readBody(event);
    const businessId = body?.businessId as string | undefined;
    if (!businessId) {
      throw createError({ statusCode: 400, statusMessage: 'Business ID is required' });
    }

    const db = useDrizzle();
    const githubAccounts = await db.select().from(account).where(
      and(eq(account.userId, user.id), eq(account.providerId, 'github'))
    );
    const githubAccount = githubAccounts?.[0];

    const tokenData = githubAccount
      ? await getAccessTokenHelper(getHeaders(event), {
          providerId: 'github',
          userId: user.id,
          accountId: githubAccount.id,
        })
      : null;
    const githubToken = tokenData?.accessToken;

    // Remove the key from GitHub if token available
    if (githubToken) {
      try {
        const listRes = await fetch('https://api.github.com/user/keys', {
          headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'MagicSync', Accept: 'application/vnd.github+json' },
        });
        if (listRes.ok) {
          const keys = (await listRes.json()) as Array<{ id: number; title: string }>;
          const target = keys.find((k) => k.title === 'MagicSync dev-null.sh');
          if (target) {
            await fetch(`https://api.github.com/user/keys/${target.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'MagicSync', Accept: 'application/vnd.github+json' },
            });
          }
        }
      } catch (e) {
        log.warn({ message: 'Could not remove GitHub key during revoke', error: (e as Error)?.message });
      }
    }

    // Find and delete the devnull social media account row
    const accounts = await socialMediaAccountService.getAccounts({ userId: user.id, platform: 'devnull', businessId });
    for (const acc of accounts) {
      await socialMediaAccountService.deleteAccount(acc.id, user.id);
    }

    log.info({ message: 'dev-null.sh key revoked', userId: user.id });
    return { success: true };
  } catch (error) {
    log.error({ message: 'dev-null.sh revoke failed', error: (error as Error)?.message });
    throw createError({
      statusCode: (error as { statusCode?: number })?.statusCode || 500,
      statusMessage: (error as { statusMessage?: string })?.statusMessage || 'Revoke failed',
    });
  }
});