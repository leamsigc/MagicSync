import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { buildCapabilityRunContext } from '#layers/BaseAgent/server/capabilities/run-context'
import { runCapability } from '#layers/BaseAgent/server/capabilities'
import '#layers/BaseAgent/server/capabilities/sql'
import { generationErrorStatus } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.query?.trim()) throw createError({ statusCode: 400, statusMessage: 'Query is required' })

  const ctx = await buildCapabilityRunContext(user.id, null, {
    event,
    capability: 'content.sql',
  })
  const outcome = await runCapability('content.sql', { question: body.query }, ctx)
  if (!outcome.ok) {
    throw createError({ statusCode: generationErrorStatus(outcome.code), statusMessage: outcome.error, data: { code: outcome.code } })
  }

  return {
    query: body.query,
    sql: outcome.output.sql,
    explanation: outcome.output.explanation,
    tables_used: outcome.output.tables_used,
  }
})
