import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { runSocialCapability, contextFlags } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  if (!body?.platform?.trim()) throw createError({ statusCode: 400, statusMessage: 'Platform is required' })

  const count = Math.min(Math.max(Number(body.count) || 5, 1), 15)
  const data = await runSocialCapability<{ hooks: string[] }>(user.id, 'social.hooks', {
    topic: body.topic,
    platform: body.platform,
    count,
  }, { ...contextFlags(body), event })
  return { hooks: data.hooks, count: data.hooks.length }
})
