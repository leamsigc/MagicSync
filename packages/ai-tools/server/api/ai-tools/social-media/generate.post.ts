import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, socialComplete, toSocialPost } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  if (!body?.platform?.trim()) throw createError({ statusCode: 400, statusMessage: 'Platform is required' })

  const context = contextFlags(body)
  const data = await socialComplete(user.id, {
    ...context,
    event,
    system: 'You are a social media copywriter. Return strict JSON only.',
    prompt: [
      `Write one ${body.platform} post about: ${body.topic}.`,
      `Tone: ${body.tone || 'professional'}.`,
      body.include_hashtags === false ? 'Do not include hashtags.' : 'Include 3-5 relevant hashtags.',
      body.include_cta ? 'End with a clear call to action.' : '',
      body.additional_context ? `Extra context: ${body.additional_context}` : '',
      body.max_length ? `Keep the caption under ${body.max_length} characters.` : '',
      'Return strict JSON: {"text": string, "hashtags": string[]}.',
    ].filter(Boolean).join('\n'),
  })

  return { post: toSocialPost(data.json ?? { text: data.text }, body.platform) }
})
