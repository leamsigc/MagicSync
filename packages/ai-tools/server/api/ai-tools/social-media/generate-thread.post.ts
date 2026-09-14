import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, socialComplete, toSocialPost } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })

  const platform = body.platform || 'twitter'
  const tweetCount = Math.min(Math.max(Number(body.tweet_count) || 5, 2), 15)
  const data = await socialComplete(user.id, {
    ...contextFlags(body),
    event,
    system: 'You write social threads. Return strict JSON only.',
    prompt: [
      `Write a ${tweetCount}-post ${platform} thread about: ${body.topic}.`,
      body.hook_first === false ? 'Do not start with a hook.' : 'Start with a strong hook.',
      'Return strict JSON: {"tweets": [{"text": string, "hashtags": string[]}]}.',
    ].join('\n'),
  })

  const rawTweets = Array.isArray(data.json?.tweets) ? data.json.tweets : []
  const tweets = rawTweets
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry, index) => ({ ...toSocialPost(entry, platform), tweet_number: index + 1 }))
    .filter(entry => entry.text.length > 0)
  return { tweets, tweet_count: tweets.length }
})
