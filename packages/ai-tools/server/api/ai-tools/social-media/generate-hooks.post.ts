import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contextFlags, socialComplete } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  if (!body?.platform?.trim()) throw createError({ statusCode: 400, statusMessage: 'Platform is required' })

  const count = Math.min(Math.max(Number(body.count) || 5, 1), 15)
  const data = await socialComplete(user.id, {
    ...contextFlags(body),
    event,
    system: 'You write scroll-stopping hooks. Return strict JSON only.',
    prompt: [
      `Write ${count} hooks for a ${body.platform} post about: ${body.topic}.`,
      'Return strict JSON: {"hooks": [{"hook": string, "hook_type": string}]}.',
    ].join('\n'),
  })

  const rawHooks = Array.isArray(data.json?.hooks) ? data.json.hooks : []
  const hooks = rawHooks
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map(entry => ({ hook: String(entry.hook ?? ''), hook_type: String(entry.hook_type ?? 'general') }))
    .filter(entry => entry.hook.length > 0)
  return { hooks, count: hooks.length }
})
