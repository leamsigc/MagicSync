import { type H3Event } from 'h3'
import type { User } from '#layers/BaseDB/db/schema'
import { symmetricEncrypt, symmetricDecrypt } from 'better-auth/crypto'
import { useAuthApi } from './useAuthApi'
import { auth } from '#layers/BaseAuth/lib/auth'

/**
 * Get the authenticated session from the request event.
 * Reads cookie/session headers automatically from event.
 */
export const getUserSessionFromEvent = async (e: H3Event) => {
  return await useAuthApi(e).getSession()
}

/**
 * Require a logged-in user. Throws 401 if not authenticated.
 * Returns the user object.
 */
export const checkUserIsLogin = async (event: H3Event): Promise<User> => {
  const session = await useAuthApi(event).getSession()
  const user = session?.user as User | undefined

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }
  return user
}

/**
 * Generic method to get access token from Better Auth.
 *
 * Two calling patterns:
 *   - With H3Event (from request handlers):  getAccessTokenHelper(event, { providerId, accountId })
 *   - With Headers  (from background jobs):  getAccessTokenHelper(headers, { providerId, accountId })
 *
 * Headers are auto-extracted from event, or passed directly for scheduler/cron contexts.
 */
export const getAccessTokenHelper = async (
  eventOrHeaders: Headers,
  options: {
    providerId: string
    accountId?: string
    userId?: string
  }
) => {

  log.info({ message: '### Token Helper####', providerId: options.providerId, accountId: options.accountId, userId: options.userId })
  try {
    // NOTE: Better Auth's /get-access-token schema accepts ONLY { accountId }
    // and/or { userId } (strictObject) and resolves strictly by its own row
    // id. providerId must NOT be forwarded, and accountId must be the
    // Better Auth row id — never our social_media_accounts id.
    const resp = await auth.api.getAccessToken({
      body: {
        ...(options.accountId ? { accountId: options.accountId } : {}),
        ...(options.userId ? { userId: options.userId } : {}),
      },
      headers: eventOrHeaders // headers containing the user's session token
    })
    // SAFE: never log the access token / id token — log presence and expiry only
    log.info({
      message: 'Got access token',
      providerId: options.providerId,
      hasAccessToken: !!resp?.accessToken,
      accessTokenExpiresAt: resp?.accessTokenExpiresAt,
      scopes: resp?.scopes,
    })
    return resp;
  } catch (error) {
    // SAFE: log error type/message only — the error object may embed request headers/tokens
    log.info({
      message: 'Error getting access token',
      error: error instanceof Error ? error.message : String(error),
    })

  }
}

/**
 * Encrypt a string using better-auth's symmetric encryption.
 */
export const encryptKey = async (data: string) => {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('[auth] BETTER_AUTH_SECRET env var is required — encryption unavailable')
  }
  return symmetricEncrypt({
    key: process.env.BETTER_AUTH_SECRET,
    data
  })
}

/**
 * Decrypt a string using better-auth's symmetric encryption.
 */
export const decryptKey = async (data: string) => {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('[auth] BETTER_AUTH_SECRET env var is required — decryption unavailable')
  }
  return symmetricDecrypt({
    key: process.env.BETTER_AUTH_SECRET,
    data
  })
}
