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
