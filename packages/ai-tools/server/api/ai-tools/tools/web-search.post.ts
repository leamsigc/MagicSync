import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ query: body.query?.substring(0, 100) })

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
