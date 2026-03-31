import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.query?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Query is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const result = await $fetch<{
    query: string
    results: Array<{ title: string; url: string; snippet: string }>
    total_results: number
  }>(`${backendUrl}/api/v1/tools/web-search`, {
    method: 'POST',
    body: { query: body.query, max_results: body.max_results || 5 },
    headers: { 'X-User-Id': user.id },
  })

  return result
})
