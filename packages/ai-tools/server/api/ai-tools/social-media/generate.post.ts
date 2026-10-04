import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { runSocialCapability, contextFlags, toSocialPost } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  if (!body?.platform?.trim()) throw createError({ statusCode: 400, statusMessage: 'Platform is required' })

  const data = await runSocialCapability<{ text: string, hashtags: string[] }>(user.id, 'social.caption', {
    topic: body.topic,
    platform: body.platform,
    tone: body.tone || 'professional',
    includeHashtags: body.include_hashtags !== false,
    includeCta: Boolean(body.include_cta),
    additionalContext: body.additional_context,
    maxLength: Number(body.max_length) || undefined,
  }, { ...contextFlags(body), event })

  return { post: toSocialPost(data, body.platform) }
})
