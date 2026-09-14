import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, socialComplete, toSocialPost } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.base_content?.trim()) throw createError({ statusCode: 400, statusMessage: 'base_content is required' })

  const count = Math.min(Math.max(Number(body.count) || 3, 1), 10)
  const platform = body.platform || 'twitter'
  const data = await socialComplete(user.id, {
    ...contextFlags(body),
    event,
    system: 'You rewrite social copy. Return strict JSON only.',
    prompt: [
      `Create ${count} ${body.variation_type || 'rephrase'} variations of this ${platform} post:`,
      body.base_content,
      'Return strict JSON: {"variations": [{"text": string, "hashtags": string[]}]}.',
    ].join('\n'),
  })

  const rawVariations = Array.isArray(data.json?.variations) ? data.json.variations : []
  const variations = rawVariations
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map(entry => toSocialPost(entry, platform))
    .filter(entry => entry.text.length > 0)
  return { variations, count: variations.length }
})
