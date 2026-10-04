import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, runSocialCapability, toSocialPost, type SocialPostPayload } from '#ai-tools/server/utils/socialAi'

interface BatchOutput {
  posts: Record<string, Array<{ text: string, hashtags: string[] }>>
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  const platforms: string[] = Array.isArray(body?.platforms) ? body.platforms.filter(Boolean) : []
  if (platforms.length === 0) throw createError({ statusCode: 400, statusMessage: 'Platforms are required' })

  const countPerPlatform = Math.min(Math.max(Number(body.count_per_platform) || 1, 1), 5)
  const data = await runSocialCapability<BatchOutput>(user.id, 'social.batch', {
    topic: body.topic,
    platforms,
    countPerPlatform,
    tone: body.tone || 'professional',
    includeHashtags: body.include_hashtags !== false,
    includeCta: body.include_cta === true,
  }, { ...contextFlags(body), event })

  const posts: Record<string, SocialPostPayload[]> = {}
  let generatedCount = 0
  for (const platform of platforms) {
    const entries = data.posts[platform] ?? []
    posts[platform] = entries
      .map(entry => toSocialPost(entry, platform))
      .filter(entry => entry.text.length > 0)
    generatedCount += posts[platform].length
  }

  return { posts, generated_count: generatedCount }
})
