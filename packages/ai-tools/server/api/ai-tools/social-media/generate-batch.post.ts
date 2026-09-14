import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, socialComplete, toSocialPost, type SocialPostPayload } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  const platforms: string[] = Array.isArray(body?.platforms) ? body.platforms.filter(Boolean) : []
  if (platforms.length === 0) throw createError({ statusCode: 400, statusMessage: 'Platforms are required' })

  const countPerPlatform = Math.min(Math.max(Number(body.count_per_platform) || 1, 1), 5)
  const data = await socialComplete(user.id, {
    ...contextFlags(body),
    event,
    maxTokens: 2400,
    system: 'You are a social media copywriter. Return strict JSON only.',
    prompt: [
      `Write ${countPerPlatform} post(s) per platform for: ${body.topic}.`,
      `Platforms: ${platforms.join(', ')}. Tone: ${body.tone || 'professional'}.`,
      body.include_hashtags === false ? 'Do not include hashtags.' : 'Include 3-5 relevant hashtags per post.',
      body.include_cta ? 'End each post with a clear call to action.' : '',
      'Return strict JSON: {"posts": {"<platform>": [{"text": string, "hashtags": string[]}]}}.',
    ].filter(Boolean).join('\n'),
  })

  const rawPosts = (typeof data.json?.posts === 'object' && data.json.posts !== null ? data.json.posts : {}) as Record<string, unknown>
  const posts: Record<string, SocialPostPayload[]> = {}
  let generatedCount = 0
  for (const platform of platforms) {
    const entries = Array.isArray(rawPosts[platform]) ? rawPosts[platform] : []
    posts[platform] = entries
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map(entry => toSocialPost(entry, platform))
      .filter(entry => entry.text.length > 0)
    generatedCount += posts[platform].length
  }

  return { posts, generated_count: generatedCount }
})
