import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, runSocialCapability, toSocialPost } from '#ai-tools/server/utils/socialAi'

interface VariationsOutput {
  posts: Array<{ text: string, hashtags: string[] }>
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.base_content?.trim()) throw createError({ statusCode: 400, statusMessage: 'base_content is required' })

  const count = Math.min(Math.max(Number(body.count) || 3, 1), 10)
  const platform = body.platform || 'twitter'
  const data = await runSocialCapability<VariationsOutput>(user.id, 'social.variations', {
    baseContent: body.base_content,
    platform,
    count,
    variationType: body.variation_type || 'rephrase',
  }, { ...contextFlags(body), event })

  const variations = data.posts
    .map(entry => toSocialPost(entry, platform))
    .filter(entry => entry.text.length > 0)
  return { variations, count: variations.length }
})
