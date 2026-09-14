import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { extractJsonObject, completeForUser } from '#layers/BaseAgent/server/utils/run-config'
import { generationErrorStatus } from '#ai-tools/server/utils/socialAi'

const SCHEMA_HINT = [
  'Core tables: posts(id, user_id, business_id, content, status, scheduled_at, published_at),',
  'business_profiles(id, user_id, name, category), social_media_accounts(id, business_id, platform, account_name),',
  'assets(id, user_id, business_id, filename, mime_type), content_items(id, business_id, title, state).',
].join(' ')

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.query?.trim()) throw createError({ statusCode: 400, statusMessage: 'Query is required' })

  const result = await completeForUser(user.id, {
    event,
    maxTokens: 700,
    system: 'You translate questions into read-only SQLite SELECT queries. Return strict JSON only.',
    prompt: [
      `Database: Turso/libSQL (SQLite dialect). ${SCHEMA_HINT}`,
      `Question: ${body.query}`,
      'Return strict JSON: {"sql": string, "explanation": string, "tables_used": string[]}.',
      'Only produce SELECT statements. Never write, alter, or drop.',
    ].join('\n'),
  })
  if (!result.success) {
    throw createError({ statusCode: generationErrorStatus(result.code), statusMessage: result.error, data: { code: result.code } })
  }

  const json = result.data.json ?? extractJsonObject(result.data.text) ?? {}
  return {
    query: body.query,
    sql: String(json.sql ?? ''),
    explanation: String(json.explanation ?? ''),
    tables_used: Array.isArray(json.tables_used) ? json.tables_used.filter(item => typeof item === 'string') : [],
  }
})
