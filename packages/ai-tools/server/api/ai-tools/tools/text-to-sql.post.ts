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
    sql: string
    explanation: string
    tables_used: string[]
  }>(`${backendUrl}/api/v1/tools/text-to-sql`, {
    method: 'POST',
    body: { query: body.query },
    headers: { 'X-User-Id': user.id },
  })

  return result
})
