import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { asStringArray, contextFlags, socialComplete } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  if (!body?.platform?.trim()) throw createError({ statusCode: 400, statusMessage: 'Platform is required' })

  const count = Math.min(Math.max(Number(body.count) || 5, 1), 20)
  const data = await socialComplete(user.id, {
    ...contextFlags(body),
    event,
    system: 'You are a social media strategist. Return strict JSON only.',
    prompt: [
      `Generate ${count} hashtags for a ${body.platform} post about: ${body.topic}.`,
      `Style: ${body.style || 'mixed'}.`,
      'Return strict JSON: {"hashtags": string[]}.',
    ].join('\n'),
  })

  const hashtags = asStringArray(data.json?.hashtags)
  return { hashtags, count: hashtags.length }
})
