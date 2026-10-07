import { auth } from '#layers/BaseAuth/lib/auth'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'

// Disconnect Google Drive: unlinks the dedicated `google-drive` Better Auth
// account row (drive.readonly grant). The Drive credential lives ONLY there —
// there is no socialMediaAccounts row for it, so the social-accounts delete
// endpoint cannot remove it. The login-identity `google` row is never touched.
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    log.set({ userId: user.id })

    const resolved = await socialMediaAccountService.findBetterAuthAccountForRefresh(user.id, 'google-drive')
    if (!resolved.success) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to find Google Drive connection' })
    }
    if (!resolved.data) {
      return { success: true, disconnected: false }
    }

    await auth.api.unlinkAccount({
      body: { accountId: resolved.data.id },
      headers: useAuthApi(event).headers(),
    })

    log.info({ message: 'Google Drive disconnected', accountId: resolved.data.id })
    return { success: true, disconnected: true }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    log.error({ message: 'Google Drive disconnect error', error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to disconnect Google Drive',
    })
  }
})
