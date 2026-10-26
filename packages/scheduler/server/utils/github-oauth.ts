import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { account } from '#layers/BaseDB/db/auth/auth'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { getAccessTokenHelper } from '#layers/BaseAuth/server/utils/AuthHelpers'

/**
 * The GitHub credential for a user.
 *
 * Publishing uses the GitHub account the user already linked through Better
 * Auth (the same one the dev-null flow uses) instead of asking for a personal
 * access token. Returns null when GitHub is not connected or the grant is gone.
 */
export async function resolveGithubToken(event: H3Event, userId: string): Promise<string | null> {
  const db = useDrizzle()
  const [row] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
    .limit(1)
  if (!row) return null

  const token = await getAccessTokenHelper(getHeaders(event), {
    providerId: 'github',
    userId,
    accountId: row.id,
  })
  return token?.accessToken ?? null
}
