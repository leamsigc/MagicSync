import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service';
import { checkUserIsLogin, encryptKey, getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers';
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
import { account } from '#layers/BaseDB/db/auth/auth';
import { eq, and } from 'drizzle-orm';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

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

    // Find the user's GitHub better-auth account row
    const db = useDrizzle();
    const githubAccounts = await db.select().from(account).where(
      and(eq(account.userId, user.id), eq(account.providerId, 'github'))
    );
    const githubAccount = githubAccounts?.[0];
    if (!githubAccount) {
      throw createError({ statusCode: 400, statusMessage: 'GitHub account not connected' });
    }

    const tokenData = await getAccessTokenHelper(getHeaders(event), {
      providerId: 'github',
      userId: user.id,
      accountId: githubAccount.id,
    });
    const githubToken = tokenData?.accessToken;
    if (!githubToken) {
      throw createError({ statusCode: 400, statusMessage: 'GitHub account not connected' });
    }

    // Get GitHub username
    const ghUserRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'MagicSync' },
    });
    if (!ghUserRes.ok) {
      throw createError({ statusCode: 400, statusMessage: 'Could not fetch GitHub profile' });
    }
    const ghUser = (await ghUserRes.json()) as { login: string; avatar_url?: string; name?: string };

    // Generate Ed25519 keypair via ssh-keygen
    const tmpDir = mkdtempSync(join(tmpdir(), 'devnull-keygen-'));
    let privateKey = '';
    let publicKey = '';
    try {
      execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', 'magicsync-devnull', '-f', join(tmpDir, 'devnull')], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      privateKey = readFileSync(join(tmpDir, 'devnull'), 'utf8');
      publicKey = readFileSync(join(tmpDir, 'devnull.pub'), 'utf8').trim();
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }

    // Register public key on GitHub
    const regRes = await fetch('https://api.github.com/user/keys', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'MagicSync',
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({ title: 'MagicSync dev-null.sh', key: publicKey }),
    });
    if (!regRes.ok) {
      const errText = await regRes.text();
      throw createError({ statusCode: 400, statusMessage: `Could not register key on GitHub: ${errText}` });
    }
    const regData = (await regRes.json()) as { id: number; key: string };

    // Encrypt and store private key
    const encrypted = await encryptKey(privateKey);
    const socialAccount = await socialMediaAccountService.createOrUpdateAccount({
      id: `devnull-${ghUser.login}`,
      name: ghUser.name || ghUser.login,
      access_token: encrypted,
      picture: ghUser.avatar_url || '',
      username: ghUser.login,
      user,
      businessId,
      platformId: 'devnull',
      baseUrl: null,
    });

    log.info({ message: 'dev-null.sh key generated and registered', githubUser: ghUser.login, keyId: regData.id });

    return { success: true, account: socialAccount };
  } catch (error) {
    const msg = (error as Error)?.message || String(error);
    log.error({ message: 'dev-null.sh setup failed', error: msg, stack: (error as Error)?.stack });
    throw createError({
      statusCode: (error as { statusCode?: number })?.statusCode || 500,
      statusMessage: msg || 'Setup failed',
    });
  }
});