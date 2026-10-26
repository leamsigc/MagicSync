import { CreatePublishConnectionSchema } from '#layers/BaseDB/db/schema'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'
import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { resolveGithubToken } from '#layers/BaseScheduler/server/utils/github-oauth'
import { ZodError } from 'zod'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  let body
  try {
    body = await readValidatedBody(event, CreatePublishConnectionSchema.parse)
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors = e.issues.map((err: { path: any[]; message: any }) => ({
        field: err.path.join('.'),
        message: err.message
      }))
      log.error({ message: 'Validation error', errors: fieldErrors })
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Error',
        data: {
          name: 'ValidationError',
          message: 'Invalid request data',
          errors: fieldErrors
        }
      })
    }
    throw e
  }

  // GitHub connections use the account the user already linked (Netlify-style);
  // a personal access token is only kept as an explicit fallback.
  if (body.provider === 'github' && !body.secret) {
    const token = await resolveGithubToken(event, user.id)
    if (!token) {
      throw createError({ statusCode: 400, statusMessage: 'Connect your GitHub account before adding a repository' })
    }
    body.secret = token
  }

  const result = await publishingService.createConnection(user.id, body, event)

  if (!result.success) {
    log.error({ message: result.error || 'Failed to create publishing connection' })
    throw createError({
      statusCode: 400,
      statusMessage: result.error || 'Failed to create publishing connection'
    })
  }

  log.info({ message: 'Publishing connection created', connectionId: result.data.id })

  return result
})
