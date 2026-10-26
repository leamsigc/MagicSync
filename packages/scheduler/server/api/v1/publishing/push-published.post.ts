import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { publishingService } from '#layers/BaseDB/server/services/publishing.service'

const BodySchema = z.object({
  businessId: z.string().min(1),
  provider: z.literal('github').default('github'),
  limit: z.number().int().min(1).max(25).default(25),
})

function artifactBody(output: unknown): string {
  let parsed: Record<string, unknown> | null = null
  if (typeof output === 'string') {
    try {
      parsed = JSON.parse(output) as Record<string, unknown>
    }
    catch {
      return ''
    }
  }
  else if (output && typeof output === 'object') {
    parsed = output as Record<string, unknown>
  }
  if (!parsed) return ''
  const article = typeof parsed.article === 'string' ? parsed.article : ''
  if (article) return article
  return typeof parsed.caption === 'string' ? parsed.caption : ''
}

/**
 * POST /api/v1/publishing/push-published
 *
 * Pushes the business's **published** articles into the active GitHub
 * connection's configured folder. Used right after a repository is connected
 * ("connect and push what already exists").
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = await readValidatedBody(event, BodySchema.parse)

  const listed = await contentBoardService.list(user.id, body.businessId, { state: 'published', limit: body.limit }, event)
  if (!listed.success) {
    throw createError({ statusCode: 500, statusMessage: listed.error || 'Could not list published articles' })
  }

  let pushed = 0
  let skipped = 0
  let failed = 0

  for (const item of listed.data) {
    const detail = await contentBoardService.get(user.id, body.businessId, item.id, event)
    const artifactId = detail.success ? detail.data.artifactId : null
    if (!artifactId) {
      skipped += 1
      continue
    }
    const artifact = await contentArtifactService.getArtifact(user.id, artifactId, body.businessId, event)
    const markdown = artifact.success ? artifactBody(artifact.data?.output) : ''
    if (!markdown.trim()) {
      skipped += 1
      continue
    }

    const result = await publishingService.pushContent(user.id, {
      businessId: body.businessId,
      provider: body.provider,
      title: item.title,
      markdown,
    }, event)

    if (result.success) pushed += 1
    else failed += 1
  }

  log.info({ message: 'Published articles pushed', pushed, skipped, failed })
  return { pushed, skipped, failed }
})
