import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, runSocialCapability, toSocialPost } from '#ai-tools/server/utils/socialAi'

interface ThreadOutput {
  posts: Array<{ text: string, hashtags: string[] }>
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })

  const platform = body.platform || 'twitter'
  const tweetCount = Math.min(Math.max(Number(body.tweet_count) || 5, 2), 15)
  const data = await runSocialCapability<ThreadOutput>(user.id, 'social.thread', {
    topic: body.topic,
    platform,
    count: tweetCount,
    hookFirst: body.hook_first !== false,
  }, { ...contextFlags(body), event })

  const tweets = data.posts
    .map((entry, index) => ({ ...toSocialPost(entry, platform), tweet_number: index + 1 }))
    .filter(entry => entry.text.length > 0)
  return { tweets, tweet_count: tweets.length }
})
