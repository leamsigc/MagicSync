import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { buildCapabilityRunContext } from '#layers/BaseAgent/server/capabilities/run-context'
import { runCapability } from '#layers/BaseAgent/server/capabilities'
import '#layers/BaseAgent/server/capabilities/social'
import { contextFlags, generationErrorStatus } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  if (!body?.platform?.trim()) throw createError({ statusCode: 400, statusMessage: 'Platform is required' })

  const count = Math.min(Math.max(Number(body.count) || 5, 1), 20)
  const context = contextFlags(body)
  const ctx = await buildCapabilityRunContext(user.id, context.businessId, {
    useBusinessContext: context.useBusinessContext,
    event,
    capability: 'social.hashtags',
  })
  const outcome = await runCapability('social.hashtags', {
    topic: body.topic,
    platform: body.platform,
    count,
    style: body.style || 'mixed',
  }, ctx)
  if (!outcome.ok) {
    throw createError({ statusCode: generationErrorStatus(outcome.code), statusMessage: outcome.error, data: { code: outcome.code } })
  }
  return { hashtags: outcome.output.hashtags, count: outcome.output.hashtags.length }
})
