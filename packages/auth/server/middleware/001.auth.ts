import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers';

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const path = event.path
  const publicApiPrefixes = ['/api/v1/assets/public', '/api/v1/podcast/search', '/api/v1/podcast/feed', '/api/v1/podcast/audio']
  const isPathPublic = publicApiPrefixes.some(prefix => path?.startsWith(prefix))

  if (path?.startsWith('/api/v1') && !isPathPublic) {
    // Allow API key auth for CLI endpoints (checked by the api-key-auth middleware)
    // if (event.context.apiKey?.valid) {
    //   return // API key auth bypasses session auth
    // }

    // Get user from session (assuming auth middleware sets this)
    const user = await checkUserIsLogin(event)
    // SAFE: only log user.id — never log email, role, image URL, or full user object at INFO level
    log.info({ content: 'User authenticated', userId: user.id })

    if (user.role !== 'admin' && path?.startsWith('/api/v1/admin')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'Admin access required.'
      })
    }
  }
})
