import type { H3Event } from 'h3'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'

async function cardArtifact(userId: string, businessId: string, artifactId: string | null, event: H3Event) {
  if (!artifactId) return null
  const artifact = await contentArtifactService.getArtifact(userId, artifactId, businessId, event)
  if (!artifact.success) throw createError({ statusCode: 500, statusMessage: artifact.error })
  return artifact.data
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  const businessId = getQuery(event).businessId
  if (!id || typeof businessId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'businessId and item id are required' })
  }

  const [item, events, checks] = await Promise.all([
    contentBoardService.get(user.id, businessId, id, event),
    contentBoardService.listEvents(user.id, businessId, id, event),
    contentBoardService.listChecks(user.id, businessId, id, event),
  ])
  if (!item.success) throw createError({ statusCode: 404, statusMessage: item.error })
  if (!events.success) throw createError({ statusCode: 500, statusMessage: events.error })
  if (!checks.success) throw createError({ statusCode: 500, statusMessage: checks.error })

  return { item: item.data, events: events.data, checks: checks.data, artifact: await cardArtifact(user.id, businessId, item.data.artifactId, event) }
})
