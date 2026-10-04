import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'

const Schema = z.object({
  businessId: z.string().min(1),
  title: z.string().min(1),
  brief: z.string().min(1),
  language: z.string().min(1),
  slug: z.string().optional(),
  repository: z.string().optional(),
  branch: z.string().optional(),
  markdown: z.string().optional(),
  targetPath: z.string().optional(),
  connectionId: z.string().optional(),
  frontmatterOverrides: z.record(z.string(), z.unknown()).optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  const body = await readValidatedBody(event, Schema.parse)
  log.set({ businessId: body.businessId })
  const result = await destinationService.prepareGithubArticle(user.id, {
    businessId: body.businessId,
    title: body.title,
    brief: body.brief,
    language: body.language,
    slug: body.slug ?? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    repository: body.repository,
    branch: body.branch,
    markdown: body.markdown,
    targetPath: body.targetPath,
    connectionId: body.connectionId,
    frontmatterOverrides: body.frontmatterOverrides,
  }, event)
  if (!result.success) {
    const code = result.code
    const status = code === 'NOT_FOUND' ? 404 : code === 'FILE_EXISTS' ? 409 : code === 'PII_DETECTED' ? 422 : 400
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  log.info({ message: 'GitHub article prepared', artifactId: result.data.artifactId })
  return result
})
