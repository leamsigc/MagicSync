import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'

const Schema = z.object({
  businessId: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().optional(),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featuredImage: z.string().optional(),
  status: z.enum(['draft', 'publish']).default('draft'),
  language: z.string().optional(),
  connectionId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })
  const body = await readValidatedBody(event, Schema.parse)
  log.set({ businessId: body.businessId })
  const result = await destinationService.prepareWordpressArticle(user.id, {
    businessId: body.businessId,
    title: body.title,
    slug: body.slug ?? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    content: body.content,
    excerpt: body.excerpt,
    category: body.category,
    tags: body.tags,
    featuredImage: body.featuredImage,
    status: body.status,
    language: body.language,
  }, event)
  if (!result.success) {
    const status = result.code === 'PII_DETECTED' ? 422 : 400
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  log.info({ message: 'WordPress article prepared', artifactId: result.data.artifactId })
  return result
})
